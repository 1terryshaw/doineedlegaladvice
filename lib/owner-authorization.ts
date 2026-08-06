export type OwnerAuthorizationListing = {
  owner_auth_token?: string | null;
  owner_auth_token_expires_at?: string | null;
  claimed?: boolean | null;
};

type OwnerDisplayListingRow = OwnerAuthorizationListing & {
  slug: string;
  name?: string | null;
  business_name?: string | null;
};

export type ControlledOwnerListing = { slug: string; label: string };

// Owner-token expiries are persisted as RFC 3339 timestamps by Postgres/Supabase.
// Do not pass arbitrary strings to Date: that permits implementation/locale-dependent
// parsing, and an Invalid Date otherwise turns the old `< now` check into a fail-open.
const OWNER_EXPIRY_RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Returns null for a valid non-expiring expiry and undefined for malformed input. */
export function parseOwnerTokenExpiry(expiresAt: string | null | undefined): number | null | undefined {
  if (expiresAt == null) return null;
  const match = OWNER_EXPIRY_RFC3339.exec(expiresAt);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second] = match;
  const calendarTimestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const calendar = new Date(calendarTimestamp);
  // Date.parse normalizes impossible calendar values (for example Feb 30), so reject
  // them before accepting its RFC 3339 result.
  if (
    calendar.getUTCFullYear() !== Number(year)
    || calendar.getUTCMonth() !== Number(month) - 1
    || calendar.getUTCDate() !== Number(day)
    || Number(hour) > 23
    || Number(minute) > 59
    || Number(second) > 59
  ) return undefined;

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

// This intentionally matches the owner-login-mint / #1176 boundary: a token
// expiring exactly now remains valid, while NULL expiry is a non-expiring token.
// A malformed non-null expiry is invalid and therefore fails closed.
export function isOwnerTokenExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  const timestamp = parseOwnerTokenExpiry(expiresAt);
  return timestamp === undefined || (timestamp !== null && timestamp < now);
}

export function hasValidOwnerAuthorization<T extends OwnerAuthorizationListing>(
  listing: T | null | undefined,
  token: string,
  now = Date.now(),
): listing is T {
  return !!listing
    && listing.owner_auth_token === token
    && listing.claimed === true
    && !isOwnerTokenExpired(listing.owner_auth_token_expires_at, now);
}

export function controlledOwnerListingsFromRows(
  rows: OwnerDisplayListingRow[],
  token: string,
  now = Date.now(),
): ControlledOwnerListing[] {
  return rows
    .filter((listing) => hasValidOwnerAuthorization(listing, token, now))
    .map((listing) => ({
      slug: listing.slug,
      label: String(listing.business_name || listing.name || listing.slug),
    }));
}
