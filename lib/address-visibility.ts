// ============================================================================
// Street-address visibility gate. Address show/hide Phase 1 (2026-09-04).
//
// ONE predicate, ONE stripper, shared verbatim by every repo in the fan.
//
// The `show_address` column is `boolean NOT NULL`, defaulted per GRAIN in the
// migration that adds it:
//   business-grain vertical -> DEFAULT true   (public NAP; what BrightLocal asked for)
//   person-grain vertical   -> DEFAULT false  (K38 — the address is often a home)
// The owner flips it on the owner edit form. Nothing else writes it.
//
// STRICT `=== true`. A missing column, a NULL, the string "false", or a read that
// silently returned a partial row all resolve to HIDDEN. This fails closed on
// purpose: the cost of a wrong `false` is a listing that shows a city instead of a
// street; the cost of a wrong `true` is publishing a private individual's home.
// ============================================================================

export type AddressBearing = {
  address?: string | null;
  postal_code?: string | null;
  show_address?: boolean | null;
};

/** Has the owner opted this listing's street address into public view? */
export function isAddressPublic(listing: AddressBearing | null | undefined): boolean {
  return listing?.show_address === true;
}

/** Permitted AND actually present — the condition for rendering a street or a Maps link. */
export function hasPublicStreet(listing: AddressBearing | null | undefined): boolean {
  return isAddressPublic(listing) && Boolean(listing?.address && listing.address.trim());
}

/**
 * THE CHOKE POINT. Nulls the street fields on a listing whose owner has not opted in,
 * before the object reaches any renderer, client-component prop, or JSON-LD builder.
 *
 * Every street consumer in the repo is downstream of this, so a call site that forgets
 * the predicate still cannot emit a street. The per-call-site gates are kept anyway —
 * they are the readable statement of intent, this is the guarantee.
 *
 * Returns a copy; the input object may be a cached ISR value and must not be mutated.
 */
export function applyAddressVisibility<T extends object>(
  listing: T | null | undefined,
): T | null {
  // Constrained to `object`, not to AddressBearing: each repo's own `Listing` interface
  // does not declare the street columns (the detail leaf casts for them), so an
  // AddressBearing constraint fails to match it and the gate could not be wired in at all.
  if (!listing) return null;
  if (isAddressPublic(listing as AddressBearing)) return listing;
  return { ...listing, address: null, postal_code: null };
}
