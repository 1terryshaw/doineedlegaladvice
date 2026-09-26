import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getAuthFromCookies, getAuthorizedOwnerListing } from "@/lib/auth";
import { GBP_OWNER_MESSAGES, resolveGoogleBusinessProfileUrl } from "@/lib/gbp-connector";
import { upgradeFeatureIdToChij } from "@/lib/gbp-chij-resolve";
import { LISTINGS_TABLE, supabaseAdmin } from "@/lib/supabase";
import { fetchInitialRating } from "@/lib/gbp-initial-rating";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = getAuthFromCookies(await cookies());
  if (!auth) return NextResponse.json({ ok: false, error: "unauthenticated", message: "Please sign in to connect Google." }, { status: 401 });

  let body: { slug?: unknown; gbpUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_url", message: GBP_OWNER_MESSAGES.invalid_url }, { status: 400 });
  }
  if (typeof body.slug !== "string" || body.slug !== auth.slug || typeof body.gbpUrl !== "string") {
    return NextResponse.json({ ok: false, error: "not_authorized", message: "Your account cannot connect this listing." }, { status: 403 });
  }

  const listing = await getAuthorizedOwnerListing<{
    id: string; slug: string; google_place_id: string | null;
  }>(auth, "id, slug, google_place_id, owner_auth_token, owner_auth_token_expires_at, claimed");
  if (!listing) return NextResponse.json({ ok: false, error: "not_authorized", message: "Your account cannot connect this listing." }, { status:403 });
  // The authenticated owner may CONNECT (place_id null) or REPLACE (place_id already
  // set — e.g. they linked the wrong profile). Same route, same owner-auth guards; no
  // 409 block. Still owner-scoped: the update below is gated on owner_auth_token + claimed.

  const resolution = await resolveGoogleBusinessProfileUrl(body.gbpUrl);
  if (!resolution.ok) {
    // claimant-edit-ux-stamp-v1 (iii): every refusal carries the Share → Copy link hint.
    return NextResponse.json({ ok: false, error: resolution.code, message: GBP_OWNER_MESSAGES[resolution.code] + " Tip: on Google Maps, open your business, tap Share, then Copy link, and paste that link here." }, { status: 400 });
  }

  // ── Paste-time ChIJ upgrade — gbp-connect-chij-resolve-v1, TDL #1256 ──────────
  // Google's Share → Copy-link never carries a ChIJ; it resolves to a feature-id
  // (0x…:0x…). That registers as CONNECTED but is review-inert forever, because
  // every reviews path gates on isChIJPlaceId() before the billed Details call.
  // When the resolver lands on a feature-id, ONE owner-triggered Places Text
  // Search is made and its ChIJ accepted ONLY on a verified name+coordinate match.
  // Every refusal keeps the feature-id: the listing stays connected, never NULL,
  // and an unverified ChIJ is never written. Non-feature-id resolutions make no
  // call at all. Authorized by Terry 2026-09-22.
  const chijUpgrade = await upgradeFeatureIdToChij({
    placeId: resolution.placeId,
    anchor: resolution.anchor,
    listingId: listing.id,
    listingSlug: listing.slug,
    listingsTable: LISTINGS_TABLE,
    placeIdColumn: "google_place_id",
    vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
    supabase: supabaseAdmin,
  });
  const effectivePlaceId = chijUpgrade.placeId;

  // owner-funnel-recovery-p1p4-v1 P2c: never downgrade a stored ChIJ. If this listing already has a ChIJ and the
  // new paste did not end in one, nothing is written (no feature-id over a working ChIJ, no link/place mismatch).
  if (((listing as { google_place_id?: string | null }).google_place_id ?? "").startsWith("ChIJ") && !effectivePlaceId.startsWith("ChIJ")) {
    return NextResponse.json({ ok: false, error: "kept_existing", message: "Your listing is already connected to Google, and we couldn't confirm the new link, so nothing was changed. If you are replacing your Google profile, contact support." }, { status: 422 });
  }

  const { error: updateError, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ google_place_id: effectivePlaceId, gbp_url: resolution.normalizedUrl,
      // P2d: a CHANGED identity never keeps the previous business's rating (refilled by the connect-time fetch below).
      ...((listing as { google_place_id?: string | null }).google_place_id !== effectivePlaceId ? { google_rating: null, google_review_count: null } : {}) }, { count: "exact" })
    .eq("id", listing.id)
    .eq("owner_auth_token", auth.token)
    .eq("claimed", true);
  if (updateError || count !== 1) {
    // google_place_id is UNIQUE on every listings table. A collision means this Google
    // profile is already linked to ANOTHER listing — an owner mistake, not a server
    // fault — so it answers 409 already_linked instead of the bare 500 it used to be.
    // Mirrors the shape of /api/owner/confirm-place-id: the other listing's identity is
    // NEVER exposed, NO auto-merge / possible_duplicate_of / dedup machinery runs, and
    // the attempt is logged to place_id_collision_log for separate adjudication.
    const isUnique =
      updateError?.code === "23505" || /unique|duplicate key/i.test(updateError?.message || "");
    if (isUnique) {
      const { data: existing } = await supabaseAdmin
        .from(LISTINGS_TABLE)
        .select("id")
        .eq("google_place_id", effectivePlaceId)
        .maybeSingle();
      await supabaseAdmin.from("place_id_collision_log").insert({
        source_table: LISTINGS_TABLE,
        vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
        attempting_listing_id: listing.id,
        existing_listing_id: (existing as { id?: string } | null)?.id ?? null,
        place_id: effectivePlaceId,
      }).then(() => {}, () => {});
      return NextResponse.json({
        ok: false,
        error: "already_linked",
        message: "That Google listing is already linked to another business in our directory. If it belongs to you, contact support and we'll get it sorted.",
      }, { status: 409 });
    }
    if (updateError) console.error("[owner/gbp-connect] restricted write failed", updateError.code);
    return NextResponse.json({ ok: false, error: "connection_not_saved", message: "We could not save the connection. Please try again." }, { status: 500 });
  }

  // Prospective provenance — TDL #1256. Every owner-initiated GBP write funnels through
  // this route, so it is the single choke point where "the owner supplied this link
  // himself" can be recorded. Uses the EXISTING empire_places_refresh_log: no schema
  // change, and no provenance column on *_listings. ZERO Google Places calls happen here
  // (resolveGoogleBusinessProfileUrl only parses the URL / follows a short link), so
  // places_called is false. Never throws: a failed audit row must not fail the owner's save.
  await supabaseAdmin
    .from("empire_places_refresh_log")
    .insert({
      vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
      listing_table: LISTINGS_TABLE,
      listing_id: listing.id,
      listing_slug: listing.slug,
      place_id: effectivePlaceId,
      outcome: "success",
      caller: "owner",
      authorization_ref: "provenance=owner_supplied (get-found save-link, TDL #1256)",
      places_called: false,
      detail: `gbp-connect resolve mode=${resolution.mode} chij=${chijUpgrade.outcome}`,
    })
    .then(() => {}, () => {});

  try {
    revalidatePath(`/owner/${listing.slug}`);
    revalidatePath(`/directory/${listing.slug}`);
    revalidateTag(`listing:${listing.slug}`);
  } catch (error) {
    console.error("[owner/gbp-connect] cache invalidation failed", error instanceof Error ? error.name : "unknown");
  }
  // claimant-edit-ux-stamp-v1: tell the UI whether the link is review-capable (audit §E.2).

  // owner-funnel-recovery-p1p4-v1 P2 addendum (Prosafe): a connected ChIJ gets its Google rating/count NOW
  // (owner-triggered, already-seeded row, shared 200/day tripwire, no review text) and the public page is
  // revalidated, so the listing shows the rating + "Reviews verified" instead of staying "Claimed" forever.
  let initialRating: string | null = null;
  if (effectivePlaceId.startsWith("ChIJ")) {
    try {
      const { data: cur } = await supabaseAdmin.from(LISTINGS_TABLE).select("google_rating").eq("id", listing.id).maybeSingle();
      const hasRating = Number((cur as { google_rating?: number | null } | null)?.google_rating) > 0;
      if ((listing as { google_place_id?: string | null }).google_place_id !== effectivePlaceId || !hasRating) {
        initialRating = (await fetchInitialRating({ listingId: String(listing.id), listingSlug: listing.slug, placeId: effectivePlaceId,
          listingsTable: LISTINGS_TABLE, vertical: process.env.BILLING_VERTICAL_SLUG ?? LISTINGS_TABLE.replace(/_listings$/, ""),
          supabase: supabaseAdmin })).outcome;
      }
    } catch { initialRating = "error_places"; }
    try { revalidatePath(`/directory/${listing.slug}`); } catch { /* best effort */ }
  }
  return NextResponse.json({ ok: true, initialRating, placeId: effectivePlaceId, gbpUrl: resolution.normalizedUrl, mode: resolution.mode, chij: chijUpgrade.outcome });
}
