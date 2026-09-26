// owner-funnel-recovery-p1p4-v1 P2 addendum (COO 2026-09-26) — initial rating/count at connect time.
//
// Live defect (Prosafe): an owner connected a valid ChIJ, but nothing ever fetched the Google rating/count for a
// non-Reviews-Plus listing (the only writers were the tier-gated /api/reviews/refresh route and the billing
// auto-find). google_rating stayed null, so the public listing showed only "Claimed" and never "Reviews verified"
// (TierBadge keys on google_rating > 0).
//
// Contract (CLAUDE.md Places rules; COO ruling): this is the authorized OWNER-TRIGGERED per-listing enrichment
// class, for an already-seeded row, one listing per call. It counts against the same 200/day owner-class tripwire
// as the paste-time ChIJ upgrade (lib/gbp-chij-resolve DAILY_CALL_CAP) and fails CLOSED when the cap can't be read.
// Field mask is rating + userRatingCount only: NO review text is fetched or stored (bodies stay Reviews Plus).
// Every call and every refusal is audited to empire_places_refresh_log (counts/outcomes only).
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_CALL_CAP, AUTHORIZATION_REF as CHIJ_AUTH_REF } from "@/lib/gbp-chij-resolve";

export const INITIAL_RATING_AUTH_REF =
  "gbp-connect-initial-rating-v1 (COO P2 addendum 2026-09-26; owner-triggered, already-seeded row)";

export type InitialRatingOutcome =
  | "initial_rating_written"   // Google returned a rating; persisted
  | "initial_rating_none"      // Google has no rating for this place yet (honest "rating appears once Google shares it")
  | "refused_rate_limited"     // daily owner-class tripwire reached, or unreadable (fail closed)
  | "refused_unconfigured"     // no API key
  | "error_places"             // Google error / timeout
  | "not_saved";               // DB write failed or row changed underneath us

export async function fetchInitialRating(o: {
  listingId: string; listingSlug: string; placeId: string; listingsTable: string; vertical: string;
  supabase: SupabaseClient;
}): Promise<{ outcome: InitialRatingOutcome; rating: number | null; count: number | null }> {
  const audit = (outcome: InitialRatingOutcome, placesCalled: boolean, detail: string) =>
    o.supabase.from("empire_places_refresh_log").insert({
      vertical: o.vertical, listing_table: o.listingsTable, listing_id: o.listingId, listing_slug: o.listingSlug,
      place_id: o.placeId, outcome, caller: "owner", authorization_ref: INITIAL_RATING_AUTH_REF,
      places_called: placesCalled, detail: detail.slice(0, 200),
    }).then(() => {}, () => {});
  const done = async (outcome: InitialRatingOutcome, called: boolean, detail: string, rating: number | null = null, count: number | null = null) => {
    await audit(outcome, called, detail); return { outcome, rating, count };
  };
  if (!o.placeId.startsWith("ChIJ")) return { outcome: "not_saved", rating: null, count: null }; // caller bug guard; no call
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return done("refused_unconfigured", false, "no_api_key");

  // Tripwire: every owner-class Places call today (paste-time upgrades + initial ratings) counts. Fail CLOSED.
  try {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count, error } = await o.supabase.from("empire_places_refresh_log")
      .select("id", { count: "exact", head: true })
      .in("authorization_ref", [CHIJ_AUTH_REF, INITIAL_RATING_AUTH_REF]).eq("places_called", true).gte("called_at", since.toISOString());
    if (error) return done("refused_rate_limited", false, `cap_unreadable:${error.code ?? "err"}`);
    if ((count ?? 0) >= DAILY_CALL_CAP) {
      console.error(`[gbp-initial-rating] DAILY_CAP_BREACH ${count}/${DAILY_CALL_CAP}`);
      return done("refused_rate_limited", false, `DAILY_CAP_BREACH ${count}/${DAILY_CALL_CAP}`);
    }
  } catch (e) {
    return done("refused_rate_limited", false, `cap_check_threw:${e instanceof Error ? e.name : "unknown"}`);
  }

  let data: { rating?: number; userRatingCount?: number };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(o.placeId)}`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "rating,userRatingCount" }, signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return done("error_places", true, `http_${res.status}`);
    data = await res.json();
  } catch (e) {
    return done("error_places", true, `fetch_threw:${e instanceof Error ? e.name : "unknown"}`);
  }
  const rating = typeof data.rating === "number" ? data.rating : null;
  const count = typeof data.userRatingCount === "number" ? data.userRatingCount : null;
  if (rating === null) return done("initial_rating_none", true, `rating=null total=${count ?? 0}`, null, count);

  // Persist only onto the row that still holds THIS place id (a concurrent re-connect wins).
  const { error, count: n } = await o.supabase.from(o.listingsTable)
    .update({ google_rating: rating, google_review_count: count ?? 0 }, { count: "exact" })
    .eq("id", o.listingId).eq("google_place_id", o.placeId);
  if (error || n !== 1) return done("not_saved", true, `write_failed:${error?.code ?? `rows=${n}`}`, rating, count);
  return done("initial_rating_written", true, `rating=${rating} total=${count ?? 0}`, rating, count);
}
