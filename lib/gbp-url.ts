// Server-side Google Business Profile URL normalize + validate.
// Ported verbatim from getapro-v2 (TDL #655 self-serve pilot) — fully
// vertical-agnostic, no config dependency. Always returns the raw URL; extracts
// gbp_place_id / gbp_cid when derivable. Hard-rejects search links, empty/non-URLs,
// and non-Google hosts.

export interface GbpResult {
  ok: boolean;
  error?: string; // user-facing inline error when !ok
  gbp_url: string; // raw, trimmed
  gbp_place_id: string | null;
  gbp_cid: string | null;
}

const MSG_EMPTY = "Please enter your Google Business Profile URL.";
const MSG_SEARCH =
  "That looks like a Google search link, not your business profile. Try again from google.com/maps.";
const MSG_NONGOOGLE = "That doesn't look like a Google link. Try copying from google.com/maps.";

function isGoogleHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "goo.gl" || h === "maps.app.goo.gl" || h === "g.co") return true;
  // google.com, www/maps.google.com, google.<cc> (google.ca, google.co.uk, ...)
  return /(^|\.)google\.[a-z.]{2,}$/.test(h);
}

function isShortHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "maps.app.goo.gl" || h === "goo.gl" || h === "g.co";
}

function isSearchLink(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  const googleWeb = h === "google.com" || h.endsWith(".google.com") || /(^|\.)google\.[a-z.]{2,}$/.test(h);
  if (!googleWeb) return false;
  return u.pathname.startsWith("/search") || (u.pathname === "/" && u.searchParams.has("q"));
}

// Expand a short link by following redirects to the canonical URL.
async function expandShortLink(url: string): Promise<string | null> {
  const opts = { redirect: "follow" as const, signal: AbortSignal.timeout(6000) };
  try {
    const res = await fetch(url, { method: "HEAD", ...opts });
    if (res.url && res.url !== url) return res.url;
  } catch {
    /* fall through to GET */
  }
  try {
    const res = await fetch(url, { method: "GET", ...opts });
    return res.url || null;
  } catch {
    return null;
  }
}

// Extract Place ID + cid from an expanded/canonical maps URL.
function extract(u: URL): { placeId: string | null; cid: string | null } {
  let placeId: string | null = null;
  let cid: string | null = null;

  // maps.google.com/?cid=<decimal>
  const cidParam = u.searchParams.get("cid");
  if (cidParam && /^\d+$/.test(cidParam)) cid = cidParam;

  // ChIJ place id sometimes present as a query param (prefer it — it can dedup
  // against the existing google_place_id column, which is ChIJ-format).
  const qpid = u.searchParams.get("query_place_id") || u.searchParams.get("place_id");
  if (qpid && /^ChIJ/i.test(qpid)) placeId = qpid;

  // data= segment: ...!1s0x<hex1>:0x<hex2>...  feature id; hex2 = cid in hex.
  const m = u.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (m) {
    if (!placeId) placeId = m[1]; // store the feature id when no ChIJ available
    const hex2 = m[1].split(":")[1];
    if (hex2 && !cid) {
      try {
        cid = BigInt(hex2).toString(); // BigInt: cids exceed 2^53
      } catch {
        /* leave cid null */
      }
    }
  }

  return { placeId, cid };
}

export async function normalizeGbpUrl(raw: string): Promise<GbpResult> {
  const trimmed = (raw || "").trim();
  const empty: GbpResult = { ok: false, error: MSG_EMPTY, gbp_url: trimmed, gbp_place_id: null, gbp_cid: null };
  if (!trimmed) return empty;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return empty;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return empty;

  if (!isGoogleHost(u.hostname)) {
    return { ok: false, error: MSG_NONGOOGLE, gbp_url: trimmed, gbp_place_id: null, gbp_cid: null };
  }
  if (isSearchLink(u)) {
    return { ok: false, error: MSG_SEARCH, gbp_url: trimmed, gbp_place_id: null, gbp_cid: null };
  }

  // Expand short links before extraction.
  let target = u;
  if (isShortHost(u.hostname)) {
    const expanded = await expandShortLink(trimmed);
    if (expanded) {
      try {
        target = new URL(expanded);
      } catch {
        /* keep original */
      }
    }
    // A short link can resolve to a search results page — re-reject if so.
    if (isSearchLink(target)) {
      return { ok: false, error: MSG_SEARCH, gbp_url: trimmed, gbp_place_id: null, gbp_cid: null };
    }
  }

  const { placeId, cid } = extract(target);
  return { ok: true, gbp_url: trimmed, gbp_place_id: placeId, gbp_cid: cid };
}
