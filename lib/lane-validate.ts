import { US_STATE_CODES } from "@/lib/region-scope";

/**
 * LANE INTAKE VALIDATION (spec §5.1 steps 2 + 4).
 *
 * Three deliberate divergences from the 55-vert donor's `/api/list-your-business` block,
 * each recorded where it is made:
 *
 *   1. CANADIAN PROVINCES ARE DROPPED. DINLA is hard US-only
 *      (`region-scope.ts :: DIRECTORY_COUNTRIES = ['US']`) and freelawyeradvice.ca owns CA.
 *      A country selector offering CA on a US site invites a submission we would refuse.
 *   2. THE GBP BLOCK IS NOT PORTED AT ALL — no `normalizeGbpUrl`, no `gbp_url`, no
 *      `place_id`, no `cid`. The lane collects no Google identifier of any kind (§7.5), and
 *      there is no column on the lane table to hold one. This is also what forces §4.2's
 *      `/claim` copy amendment: the donor card promises a Google Maps link the lane refuses.
 *   3. THE DISPOSABLE-DOMAIN LIST IS BUNDLED rather than pulled from an npm package this
 *      repo does not carry. It keeps the donor's FAIL-OPEN posture by construction: an
 *      unknown domain is ALLOWED. It is a courtesy filter, not a security control — the real
 *      proof-of-control is the verify link, which a throwaway mailbox still has to receive.
 *
 * ⚠️ `US_STATE_CODES` is IMPORTED from `lib/region-scope.ts`, not re-spelled. That set is
 * the site's geography (51 codes incl. DC), it is what `/[region]` already routes on, and a
 * second copy here would be free to drift from the one the hubs use.
 *
 * Pure functions only. No `server-only`, no database: the Layer-1 harness drives these
 * directly, so it proves the real decision and never a copy.
 */

/** US only on this site. A set, so widening is one edit and never a scattered literal. */
export const VALID_COUNTRIES = new Set(["US"]);

export function isValidRegionCode(code: string): boolean {
  return US_STATE_CODES.has((code ?? "").trim().toUpperCase());
}

/**
 * Website normaliser: accepts a BARE DOMAIN and canonicalises to `https://`, so an owner is
 * never blocked for omitting the scheme — and, more to the point, a scheme-less value never
 * lands on the row and renders as a broken RELATIVE link. Empty is VALID; website is optional.
 */
export function normalizeWebsiteUrl(raw: string): { ok: boolean; url: string | null } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: true, url: null };
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, url: null };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, url: null };
  const host = u.hostname;
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || /\s/.test(host)) {
    return { ok: false, url: null };
  }
  return { ok: true, url: candidate };
}

/** FAIL-OPEN BY CONSTRUCTION: anything not on this list is allowed. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "throwawaymail.com", "yopmail.com", "yopmail.net", "trashmail.com", "trashmail.net",
  "getnada.com", "dispostable.com", "maildrop.cc", "mailnesia.com", "fakeinbox.com",
  "sharklasers.com", "grr.la", "spam4.me", "mytemp.email", "tempinbox.com",
  "emailondeck.com", "moakt.com", "mohmal.com", "tempr.email", "discard.email",
  "burnermail.io", "mailcatch.com", "inboxkitten.com", "harakirimail.com",
]);

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return domain !== "" && DISPOSABLE_DOMAINS.has(domain);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/**
 * US ZIP shape. `postal_code` is OPTIONAL on this lane (spec §5.1 step 2), but a value that
 * IS supplied must be usable — a present-but-garbage postcode is worse than an absent one,
 * because the finder's postal branch (§2.2) blocks on it and would silently retrieve nothing.
 */
export function looksLikeUsZip(value: string): boolean {
  return /^\d{5}(?:[-\s]?\d{4})?$/.test((value ?? "").trim());
}

export interface SubmissionInput {
  readonly business_name: string;
  readonly contact_name: string;
  readonly address_line: string;
  readonly city: string;
  readonly region_state: string;
  readonly postal_code: string;
  readonly phone: string;
  readonly website: string;
  readonly public_email: string;
  readonly description: string;
  readonly submitted_by_email: string;
}

export interface ValidatedSubmission {
  readonly business_name: string;
  readonly contact_name: string | null;
  readonly address_line: string | null;
  readonly city: string;
  readonly region_state: string;
  readonly postal_code: string | null;
  /** Forced to 'US' HERE, never read from the body. See `validateSubmission`. */
  readonly country: "US";
  readonly phone: string | null;
  readonly website: string | null;
  readonly public_email: string | null;
  readonly description: string | null;
  readonly submitted_by_email: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly value: ValidatedSubmission }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** Longest strings we will store. A description is a paragraph, not an essay or a payload. */
const MAX = {
  name: 160, contact: 120, city: 120, address: 200, postal: 20, phone: 40, description: 2000,
} as const;

const trimTo = (v: string, n: number) => (v ?? "").trim().slice(0, n);
const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/**
 * THE WHOLE INTAKE DECISION, as one pure function.
 *
 * It returns a CODE as well as a message: the code is what the audit row and the tests key
 * on, the message is what a human reads. Keeping both means a copy change can never
 * accidentally change what a test asserts.
 *
 * 🔴 `country` IS NOT A PARAMETER. The donor read it from the request body; here it is
 * forced to 'US' server-side and the database CHECK (`lsl_country_us_only`) makes 'US' both
 * the default AND the only legal value. `legal_listings`' own `country` DEFAULT is 'CA' —
 * this table cannot make that mistake because there is no path by which a non-US value
 * reaches it.
 */
export function validateSubmission(input: SubmissionInput): ValidationResult {
  const business_name = trimTo(input.business_name, MAX.name);
  const city = trimTo(input.city, MAX.city);
  const region_state = trimTo(input.region_state, 2).toUpperCase();
  const submitted_by_email = (input.submitted_by_email ?? "").trim().toLowerCase();
  const postal_code = trimTo(input.postal_code ?? "", MAX.postal);

  if (business_name === "" || city === "" || region_state === "" || submitted_by_email === "") {
    return { ok: false, code: "MISSING_REQUIRED_FIELD", message: "Please fill in all required fields." };
  }
  if (!looksLikeEmail(submitted_by_email)) {
    return { ok: false, code: "EMAIL_INVALID", message: "Please enter a valid email address." };
  }
  if (!isValidRegionCode(region_state)) {
    return {
      ok: false,
      code: "REGION_INVALID",
      message: "Please choose a valid US state or the District of Columbia. This site lists US businesses only.",
    };
  }
  const site = normalizeWebsiteUrl(input.website ?? "");
  if (!site.ok) {
    return {
      ok: false,
      code: "WEBSITE_INVALID",
      message: "Please enter a valid website (e.g. www.yourbusiness.com) or leave it blank.",
    };
  }
  const publicEmail = orNull(input.public_email ?? "");
  if (publicEmail !== null && !looksLikeEmail(publicEmail)) {
    return {
      ok: false,
      code: "PUBLIC_EMAIL_INVALID",
      message: "Please enter a valid public email address, or leave it blank.",
    };
  }
  if (postal_code !== "" && !looksLikeUsZip(postal_code)) {
    return {
      ok: false,
      code: "POSTAL_CODE_INVALID",
      message: "Please enter a valid US ZIP code, e.g. 94115 or 94115-1234, or leave it blank.",
    };
  }
  if (isDisposableEmailDomain(submitted_by_email)) {
    return { ok: false, code: "EMAIL_DISPOSABLE", message: "Please use a business email address." };
  }

  return {
    ok: true,
    value: {
      business_name,
      contact_name: orNull(trimTo(input.contact_name ?? "", MAX.contact)),
      address_line: orNull(trimTo(input.address_line ?? "", MAX.address)),
      city,
      region_state,
      postal_code: postal_code === "" ? null : postal_code,
      country: "US",
      phone: orNull(trimTo(input.phone ?? "", MAX.phone)),
      website: site.url,
      public_email: publicEmail === null ? null : publicEmail.toLowerCase(),
      description: orNull(trimTo(input.description ?? "", MAX.description)),
      submitted_by_email,
    },
  };
}
