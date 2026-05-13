/**
 * POST /api/reviews/refresh/[listing_id]
 *
 * Refreshes a single listing's Google reviews into listings_reviews_cache.
 *
 * Body: { manual?: boolean }
 *   - manual=true (default): owner-triggered. Subject to 24h rate limit
 *     via last_manual_refresh_at.
 *   - manual=false: server-to-server (Stripe webhook on tier upgrade,
 *     cron). Bypasses 24h rate limit.
 *
 * Tier gate: only listings with tier in (reviews|website|growth) refresh.
 * Cache TTL: 7 days (expires_at = now + 7d).
 * Review filter: 5-star, text length > 20, sort by time DESC, top 3.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const PAID_TIERS = new Set(["reviews", "website", "growth"]);
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MANUAL_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ listing_id: string }> }
) {
  const { listing_id } = await context.params;
  let body: { manual?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body — default manual=true
  }
  const manual = body.manual !== false;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  // Fetch the listing — need google_place_id, slug, tier
  const { data: listing, error: fetchErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, google_place_id, tier, subscription_tier")
    .eq("id", listing_id)
    .single();

  if (fetchErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (!listing.google_place_id) {
    return NextResponse.json({ error: "Listing has no google_place_id" }, { status: 400 });
  }

  // Eligible if EITHER tier or subscription_tier is a paid tier (handles legacy out-of-sync data)
  const isEligible =
    PAID_TIERS.has(listing.tier as string) ||
    PAID_TIERS.has(listing.subscription_tier as string);
  if (!isEligible) {
    return NextResponse.json(
      {
        error: `Listing tier (${listing.tier ?? "?"} / ${listing.subscription_tier ?? "?"}) not eligible for reviews refresh`,
      },
      { status: 403 }
    );
  }

  // 24h rate limit on manual triggers (server-to-server bypasses).
  // last_manual_refresh_at lives on listings_reviews_cache, keyed by google_place_id.
  if (manual) {
    const { data: cacheRow } = await supabaseAdmin
      .from("listings_reviews_cache")
      .select("last_manual_refresh_at")
      .eq("google_place_id", listing.google_place_id)
      .maybeSingle();
    if (cacheRow?.last_manual_refresh_at) {
      const ageMs = Date.now() - new Date(cacheRow.last_manual_refresh_at).getTime();
      if (ageMs < MANUAL_RATE_LIMIT_MS) {
        const retryAfter = Math.ceil((MANUAL_RATE_LIMIT_MS - ageMs) / 1000);
        return NextResponse.json(
          {
            error: "Reviews were refreshed recently. Try again later.",
            retry_after_seconds: retryAfter,
          },
          { status: 429 }
        );
      }
    }
  }

  // Fetch from Places API (New)
  let placesData: { rating?: number; userRatingCount?: number; reviews?: PlacesReview[] };
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
      const errBody = await res.text();
      return NextResponse.json(
        { error: `Places API ${res.status}: ${errBody.slice(0, 200)}` },
        { status: 502 }
      );
    }
    placesData = await res.json();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Places API fetch failed" },
      { status: 502 }
    );
  }

  const filtered = filterReviews(placesData.reviews || []);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  const cacheRow: Record<string, unknown> = {
    google_place_id: listing.google_place_id,
    vertical: (verticalConfig as { tablePrefix: string }).tablePrefix.replace(/_$/, ""),
    listing_slug: listing.slug,
    rating: placesData.rating ?? null,
    user_ratings_total: placesData.userRatingCount ?? 0,
    top_reviews: filtered,
    fetched_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  if (manual) cacheRow.last_manual_refresh_at = now.toISOString();

  const { error: upsertErr, count } = await supabaseAdmin
    .from("listings_reviews_cache")
    .upsert(cacheRow, { onConflict: "google_place_id", count: "exact" });

  if (upsertErr) {
    return NextResponse.json(
      { error: `Cache upsert failed: ${upsertErr.message}` },
      { status: 500 }
    );
  }

  // Mirror rating + count back onto the listing so existing JSON-LD AggregateRating
  // (which reads listing.google_rating) stays fresh without per-page edits.
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({
      google_rating: placesData.rating ?? null,
      google_review_count: placesData.userRatingCount ?? 0,
    })
    .eq("id", listing.id);

  return NextResponse.json({
    ok: true,
    listing_id: listing.id,
    review_count: filtered.length,
    rating: cacheRow.rating,
    user_ratings_total: cacheRow.user_ratings_total,
    affected: count ?? null,
  });
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
