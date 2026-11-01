import { CA_SERVED_ON_DINLA } from "@/lib/legal-consolidation";
// lib/region-scope.ts — US+CA directory region resolution.
//
// REUSABLE PATTERN (logged in doineedadentist/PROGRESS.md item (j)): any vertical
// consolidating US+CA on a shared *_listings table that partitions US region pages
// by license_state (bar/board-of-record) while CA rows carry only province_state
// can reuse this. The two code namespaces are DISJOINT (no US state code equals a
// CA province code), so a 2-letter region code maps unambiguously to a country AND
// to the column its region pages must filter on:
//   US -> license_state (bar-of-record, TDL #458)
//   CA -> province_state (CA rows have NO license_state — it is ~100% NULL)

export const US_STATE_CODES = new Set<string>([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export const CA_PROVINCE_CODES = new Set<string>([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

export type RegionCountry = "US" | "CA";

export interface RegionScope {
  country: RegionCountry;
  // The column a region page filters on for this country.
  column: "license_state" | "province_state";
}

// Map a region code to its country + region-filter column. Returns null for
// unknown codes so the caller can choose a fallback.
export function resolveRegionScope(code: string): RegionScope | null {
  const c = code.toUpperCase();
  if (CA_PROVINCE_CODES.has(c)) return { country: "CA", column: "province_state" };
  if (US_STATE_CODES.has(c)) return { country: "US", column: "license_state" };
  return null;
}

// ── TDL #1402 consolidation: DINLA is canonical; CA provinces are switched on as ROUTING over
// the same legal_listings rows (lib/legal-consolidation.ts). With CA_SERVED_ON_DINLA empty,
// every helper below reduces EXACTLY to the 2026-07-26 US-only split.

/** CA provinces whose published rows DINLA serves. Validated against the CA code set. */
export const SERVED_CA_PROVINCES: string[] = CA_SERVED_ON_DINLA.filter((c) => CA_PROVINCE_CODES.has(c));

// Countries the directory serves. Mutable string[] so it drops into PostgREST `.in("country", …)`.
export const DIRECTORY_COUNTRIES: string[] = SERVED_CA_PROVINCES.length ? ["US", "CA"] : ["US"];

// The CA exclusion, as a CHAINABLE `.not(col, op, val)` triple so every read keeps its shape:
//   .in("country", DIRECTORY_COUNTRIES).not(SCOPE_NOT_COL, SCOPE_NOT_OP, SCOPE_NOT_VAL)
// - nothing switched on ⇒ NOT country = '__NONE__' (a no-op) ⇒ exactly the US-only split.
// - otherwise ⇒ NOT province_state IN (every unswitched CA code + sentinel). NOT IN also drops
//   NULL province_state, so the 46 province-less CA rows stay FLA-only. US/CA codes are
//   disjoint, so this can never exclude a US state.
const UNSERVED_CA_IN = `(${["__NONE__", ...Array.from(CA_PROVINCE_CODES).filter((c) => !SERVED_CA_PROVINCES.includes(c))].join(",")})`;
export const SCOPE_NOT_COL: string = SERVED_CA_PROVINCES.length ? "province_state" : "country";
export const SCOPE_NOT_OP: string = SERVED_CA_PROVINCES.length ? "in" : "eq";
export const SCOPE_NOT_VAL: string = SERVED_CA_PROVINCES.length ? UNSERVED_CA_IN : "__NONE__";

/** True when DINLA serves this 2-letter region code (any US state; a CA province only if switched on). */
export function isServedRegionCode(code: string): boolean {
  const c = code.toUpperCase();
  if (CA_PROVINCE_CODES.has(c)) return SERVED_CA_PROVINCES.includes(c);
  return US_STATE_CODES.has(c);
}

/** Region-scoped predicate: country+column from the disjoint code; an unswitched CA code matches nothing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function regionScoped<Q>(q: Q, code: string): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = q as any;
  const c = code.toUpperCase();
  const scope = resolveRegionScope(c);
  if (!scope) return b.in("country", DIRECTORY_COUNTRIES).not(SCOPE_NOT_COL, SCOPE_NOT_OP, SCOPE_NOT_VAL).eq("license_state", c);
  if (scope.country === "CA" && !SERVED_CA_PROVINCES.includes(c)) return b.eq("country", "__UNSERVED__");
  return b.eq("country", scope.country).eq(scope.column, c);
}

// CA province display names (for breadcrumb / country crumb derivation).
export const CANADA_LABEL = "Canada";
export const USA_LABEL = "United States";

export function regionCountryLabel(code: string): string {
  return resolveRegionScope(code)?.country === "CA" ? CANADA_LABEL : USA_LABEL;
}
