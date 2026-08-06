import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_GBP_URL_LENGTH = 2_048;
export const MAX_REDIRECTS = 3;
export const RESOLVER_TIMEOUT_MS = 6_000;
export const MAX_RESPONSE_BYTES = 32_768;

export type GbpConnectorError =
  | "invalid_url"
  | "unsupported_google_link"
  | "redirect_left_google"
  | "could_not_resolve_link"
  | "could_not_extract_place_id"
  | "resolver_timeout";

export type GbpResolution =
  | { ok: true; placeId: string; normalizedUrl: string; mode: "literal" | "redirect" }
  | { ok: false; code: GbpConnectorError };

type ResolverDependencies = {
  fetch?: typeof fetch;
  lookup?: typeof dnsLookup;
};

const PLACE_ID = /\b(ChIJ[A-Za-z0-9_-]{10,250})\b/;
// Google's own Share → Copy-link (maps.app.goo.gl/…) frequently resolves to a
// /maps/place/…/data=!…!1s0x<hex>:0x<hex>… URL that carries NO ChIJ place id — the
// place is identified by the feature-id / CID-hex pair in the `!1s0x…:0x…` data
// segment (hex2 = CID). Accept it as the identifier when no ChIJ is present, matching
// lib/gbp-url.ts extract(). This is still pure URL parsing — no Places API call.
const FEATURE_ID = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

// An explicit Google registry, rather than a suffix match, prevents lookalikes such
// as google.com.attacker.test. Short hosts are the only permitted redirect entrypoints.
const GOOGLE_SUFFIXES = new Set([
  "com", "ca", "co.uk", "com.au", "de", "fr", "it", "es", "nl", "be", "ch", "at", "ie", "pt",
  "se", "no", "dk", "fi", "pl", "cz", "sk", "hu", "ro", "gr", "com.br", "com.mx", "com.ar",
  "co.in", "co.jp", "co.kr", "co.nz", "co.za", "com.tr", "com.sg", "com.hk", "com.tw", "co.th",
  "com.my", "com.ph", "com.vn", "co.id", "ae", "sa", "co.il", "com.ua", "ru", "com.pk", "com.bd",
]);

function isApprovedGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (SHORT_HOSTS.has(host)) return true;
  const match = host.match(/^(?:[a-z0-9-]+\.)*google\.(.+)$/);
  return Boolean(match && GOOGLE_SUFFIXES.has(match[1]));
}

function isUnsafeAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || b === 88)) ||
      (a === 198 && (b === 18 || b === 51)) ||
      (a === 203 && b === 0);
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) || lower.startsWith("ff") || lower.startsWith("2001:db8");
  }
  return true;
}

function parseApprovedUrl(raw: string): { url?: URL; error?: GbpConnectorError } {
  if (!raw || raw.length > MAX_GBP_URL_LENGTH) return { error: "invalid_url" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "invalid_url" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { error: "invalid_url" };
  if (isIP(url.hostname) || !isApprovedGoogleHost(url.hostname)) return { error: "unsupported_google_link" };
  if (url.pathname.startsWith("/search") || (url.pathname === "/" && url.searchParams.has("q"))) {
    return { error: "unsupported_google_link" };
  }
  return { url };
}

function normalizedStoredUrl(url: URL): string {
  // Only persist the canonical Google origin and path. Query/fragment parameters
  // frequently carry tracking and must not become retained owner-submitted metadata.
  return `https://${url.hostname.toLowerCase()}${url.pathname || "/"}`;
}

function literalPlaceId(value: string): string | null {
  // Prefer a ChIJ place id (dedups against the ChIJ-format google_place_id column);
  // otherwise fall back to the feature-id / CID-hex pair carried by maps.app.goo.gl
  // share links, which have no ChIJ.
  return value.match(PLACE_ID)?.[1] || value.match(FEATURE_ID)?.[1] || null;
}

async function assertSafeGoogleAddress(url: URL, lookup: typeof dnsLookup): Promise<GbpConnectorError | null> {
  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isUnsafeAddress(address))) {
      return "could_not_resolve_link";
    }
    return null;
  } catch {
    return "could_not_resolve_link";
  }
}

async function requestRedirect(
  url: URL,
  method: "HEAD" | "GET",
  deps: Required<ResolverDependencies>,
  deadline: number,
): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new DOMException("Timed out", "TimeoutError");
  const response = await deps.fetch(url, {
    method,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(remaining),
  });
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    void response.body?.cancel();
    throw new Error("response_too_large");
  }
  return response;
}

/** Resolve an owner-pasted Google URL without calling Places or reading a response body. */
export async function resolveGoogleBusinessProfileUrl(
  raw: string,
  dependencies: ResolverDependencies = {},
): Promise<GbpResolution> {
  const parsed = parseApprovedUrl(raw);
  if (!parsed.url) return { ok: false, code: parsed.error! };
  const initial = parsed.url;
  const literal = literalPlaceId(initial.href);
  if (literal) return { ok: true, placeId: literal, normalizedUrl: normalizedStoredUrl(initial), mode: "literal" };

  const deps: Required<ResolverDependencies> = { fetch: dependencies.fetch || fetch, lookup: dependencies.lookup || dnsLookup };
  let current = initial;
  const deadline = Date.now() + RESOLVER_TIMEOUT_MS;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const addressError = await assertSafeGoogleAddress(current, deps.lookup);
      if (addressError) return { ok: false, code: addressError };

      let response = await requestRedirect(current, "HEAD", deps, deadline);
      if (response.status === 405 || response.status === 501) {
        response = await requestRedirect(current, "GET", deps, deadline);
      }
      if (!REDIRECT_STATUS.has(response.status)) {
        const placeId = literalPlaceId(current.href);
        return placeId
          ? { ok: true, placeId, normalizedUrl: normalizedStoredUrl(initial), mode: "redirect" }
          : { ok: false, code: "could_not_extract_place_id" };
      }
      const location = response.headers.get("location");
      if (!location) return { ok: false, code: "could_not_resolve_link" };
      const next = new URL(location, current);
      const nextParsed = parseApprovedUrl(next.href);
      if (!nextParsed.url) {
        return { ok: false, code: nextParsed.error === "unsupported_google_link" ? "redirect_left_google" : "could_not_resolve_link" };
      }
      current = nextParsed.url;
      const placeId = literalPlaceId(current.href);
      if (placeId) return { ok: true, placeId, normalizedUrl: normalizedStoredUrl(initial), mode: "redirect" };
      if (hop === MAX_REDIRECTS) return { ok: false, code: "could_not_resolve_link" };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return { ok: false, code: "resolver_timeout" };
    return { ok: false, code: "could_not_resolve_link" };
  }
  return { ok: false, code: "could_not_resolve_link" };
}

export const GBP_OWNER_MESSAGES: Record<GbpConnectorError, string> = {
  invalid_url: "Enter a complete HTTPS Google Business Profile link.",
  unsupported_google_link: "Use a Google Maps or Google Business Profile share link.",
  redirect_left_google: "That link redirected outside Google and was not connected.",
  could_not_resolve_link: "We could not resolve that Google link. Please copy a new share link and try again.",
  could_not_extract_place_id: "We could not find a Google Place ID in that link. Please try a different Google share link.",
  resolver_timeout: "Google took too long to respond. Please try again.",
};

export const __testables__ = { isApprovedGoogleHost, isUnsafeAddress, literalPlaceId, normalizedStoredUrl };
