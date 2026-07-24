/**
 * POST /api/reviews/refresh/[listing_id]  — reviews-restore fleet template (2026-07-23)
 *
 * AUTHORIZED per Terry's 2026-07-23 ruling: "top reviews displayed is the main Reviews Plus
 * feature. Restore it." This route is INTENTIONAL, not frozen legacy. Do NOT re-stub it to 501.
 * See the ZERO GOOGLE PLACES block in ~/empire/CLAUDE.md. The class of call is a REFRESH of an
 * already-seeded row behind a tier gate (permitted) — it never seeds.
 *
 * Based on canadaforyou's route, WITH the owner-auth gate canadaforyou lacked. Enforcement layer
 * (the Python guard cannot gate a Next.js route), in order:
 *   1. owner-auth (verifyOwnerAccess)      → 401   [audit capped to console — anti write-amplification]
 *   2. tier grants reviews_display         → 403
 *   3. google_place_id present (no search) → 400
 *   4. 24h anti-hammer per place_id        → 429   (owner-initiated; NO cron)
 *   5. write listings_reviews_cache; audit every authenticated call + refusal
 *
 * The listing fetch uses select("*") DELIBERATELY — do NOT "optimize" it into an enumerated
 * column list. The 60+ listings tables are not column-uniform (unitedstatesforyou_listings has
 * no gbp_url); an enumerated select errors in PostgREST and 404s EVERY request on that vertical.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { verifyOwnerAccess } from "@/lib/auth";
import { normalizeGbpUrl } from "@/lib/gbp-url";
import verticalConfig from "@/lib/vertical.config";
import { can } from "@/lib/tier-capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Attribution fields REQUIRED by Google when review content is displayed. */
const PLACES_FIELD_MASK = [
  "id",
  "rating",
  "userRatingCount",
  "reviews.rating",
  "reviews.text.text",
  "reviews.publishTime",
  "reviews.relativePublishTimeDescription",
  "reviews.authorAttribution.displayName",
  "reviews.authorAttribution.uri",
  "reviews.authorAttribution.photoUri",
].join(",");

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MANUAL_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

const MIN_RATING = 4;
const MIN_TEXT_LEN = 20;
const MAX_REVIEWS = 5;

const AUTHORIZATION_REF = "reviews-restore fleet template (Terry ruling 2026-07-23)";
const VERTICAL = (verticalConfig as { tablePrefix: string }).tablePrefix.replace(/_$/, "");

interface PlacesReview {
  rating?: number;
  text?: { text?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

interface CachedReview {
  text: string;
  rating: number;
  time: number;
  author_name: string;
  author_url: string | null;
  profile_photo_url: string | null;
  relative_time: string;
}

function filterReviews(raw: PlacesReview[]): CachedReview[] {
  return raw
    .filter((r) => (r.rating ?? 0) >= MIN_RATING && (r.text?.text?.length ?? 0) > MIN_TEXT_LEN)
    .map((r) => ({
      text: r.text!.text!,
      rating: r.rating!,
      time: r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : 0,
      author_name: r.authorAttribution?.displayName ?? "",
      author_url: r.authorAttribution?.uri ?? null,
      profile_photo_url: r.authorAttribution?.photoUri ?? null,
      relative_time: r.relativePublishTimeDescription ?? "",
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_REVIEWS);
}

type Outcome =
  | "success"
  | "refused_not_found"
  | "refused_not_authorized"
  | "refused_not_entitled"
  | "refused_no_place_id"
  | "resolved_gbp"
  | "resolved_search"
  | "refused_unresolved"
  | "refused_rate_limited"
  | "error_places"
  | "error_api_key_invalid"
  | "error_write";

/**
 * Fail LOUD on a dead key. An expired/invalid GOOGLE_PLACES_API_KEY sat undiscovered for
 * two months because it was audited as a generic error. This outcome is distinct so the
 * Sentinel monitor pages on it (empire-sentinel-monitor: places-key-health check).
 */
function isApiKeyDead(status: number, body: string): boolean {
  return (
    status === 400 &&
    /API_KEY_INVALID|API[_ ]?KEY[_ ]?(EXPIRED|INVALID)|API key (expired|not valid)|keyInvalid|keyExpired/i.test(body)
  );
}

/**
 * On-demand place_id resolution (owner-triggered, conservative). Ported from the
 * doineedanelectrician carve-out, with the stopword list generalized off "electric/solar"
 * to generic business tokens. When a paid listing has no google_place_id, resolve one from
 * the owner's stored GBP url (exact ChIJ) or from stored name+address+city (Text Search).
 * The matcher requires BOTH a distinctive name token AND the city to appear in the
 * candidate — it errs toward false-misses ON PURPOSE. A wrong-business mis-link is worse
 * than no reviews, so a non-confident candidate is discarded (never guessed).
 */
const NAME_STOPWORDS = new Set([
  "the", "and", "llc", "inc", "ltd", "co", "corp", "company", "services", "service",
  "solutions", "group", "dba", "clinic", "center", "centre", "studio", "shop", "store",
]);
function normName(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
/** The fleet is not column-uniform: 23 listings tables have NO `name` (acct_listings uses
 *  `business_name`). Without this fallback the matcher finds no distinctive token on those
 *  tables and the resolver silently NEVER resolves. */
function listingName(l: { name?: string | null; business_name?: string | null }): string {
  return l.name ?? l.business_name ?? "";
}
function isConfidentMatch(
  cand: { displayName?: { text?: string }; formattedAddress?: string },
  listing: { name?: string | null; business_name?: string | null; city?: string | null }
): boolean {
  const candName = normName(cand.displayName?.text ?? "");
  const candAddr = (cand.formattedAddress ?? "").toLowerCase();
  const distinctive = normName(listingName(listing))
    .split(" ")
    .filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t))[0];
  const nameMatch = !!distinctive && candName.includes(distinctive);
  const city = (listing.city ?? "").toLowerCase().trim();
  const cityMatch = !!city && candAddr.includes(city);
  return nameMatch && cityMatch;
}
async function resolveViaTextSearch(
  listing: {
    name?: string | null;
    business_name?: string | null;
    address?: string | null;
    city?: string | null;
    province_state?: string | null;
    region_slug?: string | null;
  },
  apiKey: string
): Promise<string | null> {
  const region = listing.province_state || listing.region_slug || "";
  const textQuery = [listingName(listing), listing.address, listing.city, region]
    .filter(Boolean)
    .join(" ");
  if (!textQuery.trim()) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: {
      places?: Array<{ id: string; displayName?: { text?: string }; formattedAddress?: string }>;
    } = await res.json();
    const c = (data.places || [])[0];
    return c && isConfidentMatch(c, listing) ? c.id : null;
  } catch {
    return null;
  }
}

/**
 * Durable audit trail. NEVER pass review text in `detail` — counts and error strings only.
 * The unauthenticated 401 path deliberately does NOT write here (see the owner-auth gate):
 * an anonymous caller must not be able to amplify writes into an append-only, no-TTL table.
 */
async function audit(entry: {
  listing_id?: string | null;
  listing_slug: string;
  place_id?: string | null;
  outcome: Outcome;
  caller: string;
  places_called: boolean;
  detail?: string | null;
}) {
  const { error } = await supabaseAdmin.from("empire_places_refresh_log").insert({
    vertical: VERTICAL,
    listing_table: LISTINGS_TABLE,
    listing_id: entry.listing_id ?? null,
    listing_slug: entry.listing_slug,
    place_id: entry.place_id ?? null,
    outcome: entry.outcome,
    caller: entry.caller,
    authorization_ref: AUTHORIZATION_REF,
    places_called: entry.places_called,
    detail: entry.detail ?? null,
  });
  if (error) console.error(`[reviews/refresh] AUDIT WRITE FAILED: ${error.message}`);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ listing_id: string }> }
) {
  const { listing_id } = await context.params;
  // Owner-initiated only: no cron entrypoint. `manual` is always true (drives the 24h anti-hammer).
  const caller = "owner";
  const manual = true;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  // select("*") on purpose: the resolver reads name/address/city/province_state/region_slug/gbp_url,
  // and those columns are NOT uniform across the 60+ listings tables (unitedstatesforyou_listings
  // has no gbp_url). An enumerated select errors in PostgREST on any table missing one column,
  // which surfaces as fetchErr -> a 404 on EVERY request. Schema-resilient by design.
  const { data: listing, error: fetchErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .eq("id", listing_id)
    .maybeSingle();

  if (fetchErr || !listing) {
    await audit({
      listing_slug: listing_id,
      outcome: "refused_not_found",
      caller,
      places_called: false,
      detail: "no such listing id",
    });
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // OWNER-AUTH — the caller must own THIS listing. canadaforyou lacked this: an anonymous caller
  // could fire the billed Places call on any paid listing. 401-audit CAP: log to console only,
  // never the DB table — an anonymous POST must not amplify writes into an append-only log.
  const owner = await verifyOwnerAccess(listing.slug as string);
  if (!owner) {
    console.warn(
      `[reviews/refresh] 401 unauthorized for ${listing.slug} — audit capped to console (anti write-amplification)`
    );
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // ENTITLEMENT — tier must grant reviews_display (reviews_plus+). can() resolves the "reviews" alias.
  const isEligible =
    can(listing.tier as string, "reviews_display") ||
    can(listing.subscription_tier as string, "reviews_display");
  if (!isEligible) {
    await audit({
      listing_id: listing.id as string,
      listing_slug: listing.slug as string,
      place_id: (listing.google_place_id as string) ?? null,
      outcome: "refused_not_entitled",
      caller,
      places_called: false,
      detail: `tier=${listing.tier ?? "?"} subscription_tier=${listing.subscription_tier ?? "?"}`,
    });
    return NextResponse.json(
      { error: "Reviews refresh is a Reviews Plus feature.", outcome: "refused_not_entitled" },
      { status: 403 }
    );
  }

  // NO PLACE ID — RESOLVE it (owner-triggered, on the paid path). Order: the owner's stored
  // GBP url (exact ChIJ) first, then stored name+address+city via Text Search (conservative:
  // name AND city must match, else discarded). On a confident match, PERSIST it to the row so
  // the next refresh + the display path reuse it, then proceed. On no match, fall through to the
  // GBP-url path (422 — the owner pastes their profile link). Never guesses.
  if (!listing.google_place_id) {
    let resolvedId = "";
    let via: "gbp" | "search" | "" = "";

    if (listing.gbp_url) {
      const g = await normalizeGbpUrl(listing.gbp_url as string);
      if (g.ok && g.gbp_place_id && /^ChIJ/i.test(g.gbp_place_id)) {
        resolvedId = g.gbp_place_id;
        via = "gbp";
      }
    }
    if (!resolvedId) {
      const cand = await resolveViaTextSearch(
        listing as {
          name?: string | null;
          business_name?: string | null;
          address?: string | null;
          city?: string | null;
          province_state?: string | null;
          region_slug?: string | null;
        },
        apiKey
      );
      if (cand) {
        resolvedId = cand;
        via = "search";
      }
    }

    if (!resolvedId) {
      await audit({
        listing_id: listing.id as string,
        listing_slug: listing.slug as string,
        place_id: null,
        outcome: "refused_unresolved",
        caller,
        // reaching here means the GBP url didn't yield a ChIJ, so a Text Search WAS billed.
        places_called: true,
        detail: "no confident Places match; owner must supply a Google Business Profile link",
      });
      return NextResponse.json(
        {
          error: "We couldn't match your business on Google. Add your Google Business Profile link and try again.",
          outcome: "refused_unresolved",
          needs_gbp_url: true,
        },
        { status: 422 }
      );
    }

    // Persist the resolved id so refresh #2 and the leaf's ReviewShowcase reuse it.
    await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ google_place_id: resolvedId })
      .eq("id", listing.id as string);
    (listing as { google_place_id: string }).google_place_id = resolvedId;

    await audit({
      listing_id: listing.id as string,
      listing_slug: listing.slug as string,
      place_id: resolvedId,
      outcome: via === "gbp" ? "resolved_gbp" : "resolved_search",
      caller,
      places_called: via === "search",
      detail: `resolved google_place_id via ${via}`,
    });
  }

  // 24h anti-hammer, keyed on the place_id actually being billed.
  if (manual) {
    const { data: existing } = await supabaseAdmin
      .from("listings_reviews_cache")
      .select("last_manual_refresh_at")
      .eq("google_place_id", listing.google_place_id)
      .maybeSingle();
    if (existing?.last_manual_refresh_at) {
      const ageMs = Date.now() - new Date(existing.last_manual_refresh_at).getTime();
      if (ageMs < MANUAL_RATE_LIMIT_MS) {
        const retryAfter = Math.ceil((MANUAL_RATE_LIMIT_MS - ageMs) / 1000);
        await audit({
          listing_id: listing.id as string,
          listing_slug: listing.slug as string,
          place_id: listing.google_place_id as string,
          outcome: "refused_rate_limited",
          caller,
          places_called: false,
          detail: `retry_after_seconds=${retryAfter}`,
        });
        return NextResponse.json(
          {
            error: "Reviews were refreshed recently. Try again later.",
            outcome: "refused_rate_limited",
            retry_after_seconds: retryAfter,
          },
          { status: 429 }
        );
      }
    }
  }

  // ---- THE BILLED CALL. Exactly one place, exactly once. ----
  let placesData: { rating?: number; userRatingCount?: number; reviews?: PlacesReview[] };
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(listing.google_place_id as string)}`,
      {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PLACES_FIELD_MASK },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      const keyDead = isApiKeyDead(res.status, errBody);
      await audit({
        listing_id: listing.id as string,
        listing_slug: listing.slug as string,
        place_id: listing.google_place_id as string,
        // Distinct outcome so a dead key PAGES via Sentinel instead of hiding as a generic error.
        outcome: keyDead ? "error_api_key_invalid" : "error_places",
        caller,
        places_called: true,
        detail: `HTTP ${res.status}: ${errBody.slice(0, 180)}`,
      });
      if (keyDead) {
        console.error(`[reviews/refresh] 🔴 GOOGLE_PLACES_API_KEY INVALID/EXPIRED for ${VERTICAL} — Sentinel should page`);
        return NextResponse.json({ error: "Reviews are temporarily unavailable (configuration)." }, { status: 503 });
      }
      return NextResponse.json({ error: `Places API ${res.status}` }, { status: 502 });
    }
    placesData = await res.json();
  } catch (err) {
    await audit({
      listing_id: listing.id as string,
      listing_slug: listing.slug as string,
      place_id: listing.google_place_id as string,
      outcome: "error_places",
      caller,
      places_called: true,
      detail: (err instanceof Error ? err.message : "fetch failed").slice(0, 180),
    });
    return NextResponse.json({ error: "Places API fetch failed" }, { status: 502 });
  }

  const returned = placesData.reviews?.length ?? 0;
  const filtered = filterReviews(placesData.reviews || []);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  const cacheRow: Record<string, unknown> = {
    google_place_id: listing.google_place_id,
    vertical: VERTICAL,
    listing_slug: listing.slug,
    rating: placesData.rating ?? null,
    user_ratings_total: placesData.userRatingCount ?? 0,
    top_reviews: filtered,
    fetched_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    source: "places",
    last_manual_refresh_at: now.toISOString(),
  };

  const { error: upsertErr } = await supabaseAdmin
    .from("listings_reviews_cache")
    .upsert(cacheRow, { onConflict: "google_place_id" });

  if (upsertErr) {
    await audit({
      listing_id: listing.id as string,
      listing_slug: listing.slug as string,
      place_id: listing.google_place_id as string,
      outcome: "error_write",
      caller,
      places_called: true,
      detail: `cache upsert: ${upsertErr.message.slice(0, 180)}`,
    });
    return NextResponse.json({ error: "Cache upsert failed" }, { status: 500 });
  }

  // Mirror aggregate back onto the listing so JSON-LD AggregateRating stays fresh.
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({
      google_rating: placesData.rating ?? null,
      google_review_count: placesData.userRatingCount ?? 0,
      google_data_cached_at: now.toISOString(),
    })
    .eq("id", listing.id as string);

  await audit({
    listing_id: listing.id as string,
    listing_slug: listing.slug as string,
    place_id: listing.google_place_id as string,
    outcome: "success",
    caller,
    places_called: true,
    detail: `returned=${returned} kept=${filtered.length} rating=${placesData.rating ?? "null"} total=${placesData.userRatingCount ?? 0} ttl_days=30`,
  });

  revalidatePath(`/directory/${listing.slug}`);

  return NextResponse.json({
    ok: true,
    outcome: "success",
    reviews_returned: returned,
    reviews_kept: filtered.length,
    rating: placesData.rating ?? null,
    user_ratings_total: placesData.userRatingCount ?? 0,
    fetched_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
