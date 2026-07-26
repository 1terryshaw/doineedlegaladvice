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

// Countries the directory serves. US-only (country split 2026-07-26): FLA keeps
// CA-only, DINLA is US-only, disjoint slices. Mutable string[] (not `as const`) so it
// drops straight into PostgREST `.in("country", …)`.
export const DIRECTORY_COUNTRIES: string[] = ["US"];

// CA province display names (for breadcrumb / country crumb derivation).
export const CANADA_LABEL = "Canada";
export const USA_LABEL = "United States";

export function regionCountryLabel(code: string): string {
  return resolveRegionScope(code)?.country === "CA" ? CANADA_LABEL : USA_LABEL;
}
