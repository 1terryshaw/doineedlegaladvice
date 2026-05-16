/**
 * GET /api/cron/reviews-refresh-claimed
 *
 * Weekly cron — refreshes Google Reviews cache for paid-tier listings only.
 * Eligibility: tier IN (reviews | lead_boost | website | growth) AND google_place_id IS NOT NULL.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * Behavior per listing:
 *   - Skip if listings_reviews_cache row exists and fetched_at < 7d old (status=skipped_fresh).
 *   - Else fetch Places API (New), filter (5★, text>20, top 3 by time), upsert cache.
 *   - Affected rows == 0 → log status=no_match (prevents V13 silent-success bug).
 *
 * Limits:
 *   - REVIEWS_REFRESH_BATCH_LIMIT (env, default 500) caps work per invocation.
 *   - 100ms inter-call delay (Places New: 6000 QPM = 100/s, conservative at 10/s).
 *
 * Logging: each listing's outcome appended to reviews_refresh_log
 *  (best-effort — table missing is non-fatal, just logged to console).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PLACES_FIELD_MASK = [
  "id",
  "rating",
  "userRatingCount",
  "reviews.rating",
  "reviews.text.text",
  "reviews.publishTime",
  "reviews.relativePublishTimeDescription",
  "reviews.authorAttribution.displayName",
].join(",");

// Tiers whose listings display full reviews (lib/tier-capabilities: reviews_display).
// "reviews" = legacy alias of lead_boost still present on un-migrated rows.
const PAID_TIERS = ["reviews", "lead_boost", "website", "growth"];
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INTER_CALL_DELAY_MS = 100;

interface PlacesReview {
  rating?: number;
  text?: { text?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
}

interface FilteredReview {
  text: string;
  rating: number;
  time: number;
  author_name: string;
  relative_time: string;
}

function filterReviews(raw: PlacesReview[]): FilteredReview[] {
  return raw
    .filter((r) => r.rating === 5 && (r.text?.text?.length ?? 0) > 20)
    .map((r) => ({
      text: r.text!.text!,
      rating: r.rating!,
      time: r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : 0,
      author_name: r.authorAttribution?.displayName ?? "",
      relative_time: r.relativePublishTimeDescription ?? "",
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 3);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logOutcome(
  vertical: string,
  listing_id: string | null,
  status: string,
  error_msg: string | null
): Promise<void> {
  try {
    await supabaseAdmin
      .from("reviews_refresh_log")
      .insert({ vertical, listing_id, status, error_msg });
  } catch (err) {
    console.warn(`[cron/reviews-refresh] log insert failed: ${(err as Error).message}`);
  }
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  const batchLimit = parseInt(process.env.REVIEWS_REFRESH_BATCH_LIMIT || "500", 10);
  const vertical = (verticalConfig as { tablePrefix: string }).tablePrefix.replace(/_$/, "");

  // Fetch eligible listings
  const { data: listings, error: queryErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, google_place_id, tier, subscription_tier")
    .or(PAID_TIERS.map((t) => `tier.eq.${t},subscription_tier.eq.${t}`).join(","))
    .not("google_place_id", "is", null)
    .limit(batchLimit);

  if (queryErr) {
    return NextResponse.json(
      { error: `Listing query failed: ${queryErr.message}` },
      { status: 500 }
    );
  }

  const total = listings?.length ?? 0;
  let refreshed = 0;
  let skipped_fresh = 0;
  let no_match = 0;
  let errors = 0;
  const errorDetails: Array<{ listing_id: string; reason: string }> = [];

  // Pre-fetch existing cache rows in one shot to avoid N+1
  const placeIds = (listings || []).map((l) => l.google_place_id).filter(Boolean) as string[];
  const cacheMap = new Map<string, { fetched_at: string }>();
  if (placeIds.length > 0) {
    const { data: cacheRows } = await supabaseAdmin
      .from("listings_reviews_cache")
      .select("google_place_id, fetched_at")
      .in("google_place_id", placeIds);
    for (const row of cacheRows || []) {
      cacheMap.set(row.google_place_id, { fetched_at: row.fetched_at });
    }
  }

  for (const listing of listings || []) {
    if (!listing.google_place_id) continue;

    // Skip-if-fresh: cache row younger than TTL
    const existing = cacheMap.get(listing.google_place_id);
    if (existing) {
      const ageMs = Date.now() - new Date(existing.fetched_at).getTime();
      if (ageMs < TTL_MS) {
        skipped_fresh++;
        await logOutcome(vertical, listing.id, "skipped_fresh", null);
        continue;
      }
    }

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(listing.google_place_id)}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": PLACES_FIELD_MASK,
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const body = await res.text();
        const reason = `Places ${res.status}: ${body.slice(0, 200)}`;
        errors++;
        errorDetails.push({ listing_id: listing.id, reason });
        await logOutcome(vertical, listing.id, "error", reason);
        await sleep(INTER_CALL_DELAY_MS);
        continue;
      }

      const placesData = (await res.json()) as {
        rating?: number;
        userRatingCount?: number;
        reviews?: PlacesReview[];
      };

      const filtered = filterReviews(placesData.reviews || []);
      const now = new Date();

      const { count, error: upsertErr } = await supabaseAdmin
        .from("listings_reviews_cache")
        .upsert(
          {
            google_place_id: listing.google_place_id,
            vertical,
            listing_slug: listing.slug,
            rating: placesData.rating ?? null,
            user_ratings_total: placesData.userRatingCount ?? 0,
            top_reviews: filtered,
            fetched_at: now.toISOString(),
            expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
          },
          { onConflict: "google_place_id", count: "exact" }
        );

      if (upsertErr) {
        errors++;
        errorDetails.push({ listing_id: listing.id, reason: upsertErr.message });
        await logOutcome(vertical, listing.id, "error", upsertErr.message);
      } else if (!count || count === 0) {
        no_match++;
        await logOutcome(vertical, listing.id, "no_match", "upsert returned 0 affected rows");
      } else {
        // Mirror rating + count onto the listing so existing JSON-LD stays fresh
        await supabaseAdmin
          .from(LISTINGS_TABLE)
          .update({
            google_rating: placesData.rating ?? null,
            google_review_count: placesData.userRatingCount ?? 0,
          })
          .eq("id", listing.id);
        refreshed++;
        await logOutcome(vertical, listing.id, "success", null);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors++;
      errorDetails.push({ listing_id: listing.id, reason });
      await logOutcome(vertical, listing.id, "error", reason);
    }

    await sleep(INTER_CALL_DELAY_MS);
  }

  return NextResponse.json({
    vertical,
    total_eligible: total,
    refreshed,
    skipped_fresh,
    no_match,
    errors,
    error_details: errorDetails.slice(0, 10),
    batch_limit: batchLimit,
  });
}
