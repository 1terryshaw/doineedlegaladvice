// Google "write a review" deep link.
//
// ZERO Google API calls. This is pure string work on identifiers we already
// store — no Places, no Maps Platform, no GBP API, no GCP credential.
//
// ── The ChIJ constraint (measured 2026-07-21, do not relax) ───────────────────
// https://search.google.com/local/writereview?placeid=<id> only resolves for a
// **ChIJ-format Place ID**. `lib/gbp-url.ts` can also return a *hex feature id*
// (`0x89d4cb35b8b0e6d1:0x9a7f3c2b1e4d5f60`) — that is what you get from the
// common case of copying a Maps place URL containing a `data=!1s…` segment. Feed
// a feature id to writereview and the link breaks.
//
// So the gate is ChIJ-only. Everything else — hex feature id, cid-only, nothing
// at all — falls back to the "your review link is in your GBP dashboard" copy.
// Better no link than a broken one.

const CHIJ = /^ChIJ/i;

/** True only for an id the writereview endpoint will actually accept. */
export function isUsablePlaceId(placeId: string | null | undefined): boolean {
  return CHIJ.test((placeId ?? "").trim());
}

/** The review URL, or null when we cannot build a WORKING one. Never partial. */
export function buildReviewLink(placeId: string | null | undefined): string | null {
  const id = (placeId ?? "").trim();
  if (!isUsablePlaceId(id)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`;
}

/**
 * Synchronous, network-free Place ID extraction from an already-stored GBP URL.
 * Mirrors the ChIJ-yielding branch of lib/gbp-url.ts `extract()` — used at RENDER
 * time, where we must not perform the short-link expansion fetch that the save
 * path does. Returns null unless a ChIJ id is present.
 */
export function placeIdFromGbpUrl(gbpUrl: string | null | undefined): string | null {
  const raw = (gbpUrl ?? "").trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const qp = u.searchParams.get("query_place_id") || u.searchParams.get("place_id");
  if (qp && CHIJ.test(qp)) return qp;
  // A bare ChIJ id can also appear in the path (…/place/?q=place_id:ChIJ…).
  const m = u.href.match(/place_id:(ChIJ[A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/**
 * Resolve the best usable Place ID for a listing: the persisted column when the
 * table has one and it is ChIJ-format, otherwise re-derived from the stored URL.
 * (webdesign_listings has no gbp_place_id column — see the migration proposal in
 * POST-BUILD.md — so that repo relies entirely on the derive path.)
 */
export function resolvePlaceId(
  storedPlaceId: string | null | undefined,
  gbpUrl: string | null | undefined
): string | null {
  if (isUsablePlaceId(storedPlaceId)) return (storedPlaceId ?? "").trim();
  return placeIdFromGbpUrl(gbpUrl);
}

/**
 * Resolve the review-link Place ID for a listing row, in the order the data
 * actually lives (TDL #1256 follow-up):
 *
 *   1. `google_place_id` — the CANONICAL column. It is what /api/owner/gbp-connect
 *      and /api/owner/confirm-place-id write, it is UNIQUE on every listings table,
 *      and it is the column every "connected" surface already keys on.
 *   2. `gbp_place_id` — the legacy column written by the retired /api/owner/gbp-url.
 *      Absent entirely on some tables (unitedstatesforyou_listings has no such
 *      column); a `select("*")` row simply yields undefined there, which is fine.
 *   3. `gbp_url` — last-resort, network-free derive.
 *
 * Each candidate passes the ChIJ gate INDEPENDENTLY: a non-ChIJ value (a hex
 * feature id, a cid-only save) is skipped rather than short-circuiting the
 * search, because a broken writereview link is worse than the dashboard copy.
 *
 * Read-side only — this resolves nothing and writes nothing.
 */
export function resolveListingPlaceId(listing: {
  google_place_id?: string | null;
  gbp_place_id?: string | null;
  gbp_url?: string | null;
}): string | null {
  for (const candidate of [listing.google_place_id, listing.gbp_place_id]) {
    if (isUsablePlaceId(candidate)) return (candidate ?? "").trim();
  }
  return placeIdFromGbpUrl(listing.gbp_url);
}
