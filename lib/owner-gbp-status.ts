// Edit Listing GBP status — claimant-edit-ux-stamp-v1 (R1, audit §E/§G).
// READ-ONLY. /api/owner/gbp-connect stays the sole GBP writer; this only tells the owner the
// truth about what is stored and where to fix it. No Places call, no Google call.
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { REPASTE_PROMPT } from "@/lib/gbp-repaste-hold";

export type OwnerGbpStatus =
  | { state: "not_connected"; linkOnFile: boolean }
  | { state: "reviews_on"; ratingShowing: boolean }
  | { state: "reviews_unavailable"; reason: string; ratingShowing: boolean };
// owner-journey-friction-fix-v1 B: ratingShowing = google_rating is stored, i.e. the rating is on the listing (ruling 1).

// One honest line per resolver outcome (lib/gbp-chij-resolve.ts ChijOutcome).
const REASONS: Record<string, string> = {
  refused_no_anchor:
    "Google's link didn't include your map pin. On Google Maps, open your business, tap Share, then Copy link, and paste it again.",
  refused_unresolved:
    "We linked your Google profile, but couldn't automatically match it to Google's review data yet, so reviews can't be shown. Your profile stays linked.",
  refused_collision:
    "That Google listing is already linked to another business in our directory. Contact us and we'll sort it out.",
  refused_rate_limited: "We couldn't check the link with Google today. Paste your Share link again tomorrow.",
  refused_unconfigured: "We couldn't check the link with Google right now. Paste your Share link again later.",
  error_places: "We couldn't check the link with Google right now. Paste your Share link again later.",
};
const DEFAULT_REASON =
  "This kind of Google link can't be matched to Google's review data. On Google Maps, open your business, tap Share, then Copy link, and paste it on your dashboard.";

// owner-funnel-recovery-p1p4-v1 P2c: "paste it again" instructions go ONLY to the REPASTE_PROMPT allow-list (the
// still-impaired owners). Everyone else — protected cohorts included — sees a neutral, true line.
const NEUTRAL_REASONS: Record<string, string> = {
  refused_no_anchor: "Your Google profile is linked, but its link didn't include your map pin, so reviews can't be shown yet.",
  refused_rate_limited: "Your Google profile is linked. We couldn't check it with Google today, so reviews aren't on yet.",
  refused_unconfigured: "Your Google profile is linked. We couldn't check it with Google right now, so reviews aren't on yet.",
  error_places: "Your Google profile is linked. We couldn't check it with Google right now, so reviews aren't on yet.",
};
const NEUTRAL_DEFAULT = "Your Google profile is linked, but we couldn't match it to Google's review data yet, so reviews can't be shown.";
function reasonFor(listingId: string | number, outcome: string | undefined): string {
  if (REPASTE_PROMPT.has(String(listingId))) return (outcome && REASONS[outcome]) || DEFAULT_REASON;
  return (outcome && (NEUTRAL_REASONS[outcome] || REASONS[outcome])) || NEUTRAL_DEFAULT;
}

export async function getOwnerGbpStatus(listing: {
  id: string | number;
  google_place_id?: string | null;
  gbp_url?: string | null;
  google_rating?: number | null;
}): Promise<OwnerGbpStatus> {
  const ratingShowing = listing.google_rating != null;
  const pid = (listing.google_place_id ?? "").trim();
  if (!pid) return { state: "not_connected", linkOnFile: Boolean((listing.gbp_url ?? "").trim()) };
  if (pid.startsWith("ChIJ")) return { state: "reviews_on", ratingShowing };
  try {
    const { data } = await supabaseAdmin
      .from("empire_places_refresh_log")
      .select("outcome")
      .eq("listing_table", LISTINGS_TABLE)
      .eq("listing_id", String(listing.id))
      .eq("place_id", pid)
      .in("outcome", Object.keys(REASONS))
      .order("called_at", { ascending: false })
      .limit(1);
    const outcome = (data as Array<{ outcome: string }> | null)?.[0]?.outcome;
    return { state: "reviews_unavailable", reason: reasonFor(listing.id, outcome), ratingShowing };
  } catch {
    return { state: "reviews_unavailable", reason: reasonFor(listing.id, undefined), ratingShowing };
  }
}
