import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";
import { normalizeGbpUrl } from "@/lib/gbp-url";

/**
 * POST /api/owner/confirm-place-id — the owner acts on a pending place_id match
 * written by empire-billing /api/place-id/resolve (two-tier display, confirm-first).
 * Owner-cookie gated (same pattern as /api/owner/gbp-url). Actions:
 *   approve → copy pending_* into the PUBLIC columns (now it renders); confirmed=true.
 *   reject  → delete the pending row (nothing renders).
 *   edit    → re-resolve from a pasted Google link (exact-ChIJ) + Pro-SKU rating/count,
 *             upsert a NEW pending row for the owner to approve. Never writes public.
 * ZERO reviews.* is ever requested — Pro SKU only.
 */
export const dynamic = "force-dynamic";

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DETAILS_MASK = "id,displayName,rating,userRatingCount"; // Pro SKU — no reviews.*

async function proDetails(placeId: string) {
  if (!PLACES_KEY) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": PLACES_KEY, "X-Goog-FieldMask": DETAILS_MASK },
  });
  if (!res.ok) return { status: res.status } as const;
  const b = await res.json();
  return { status: 200, rating: b.rating ?? null, count: b.userRatingCount ?? null, name: b.displayName?.text ?? null };
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromCookies(await cookies());
  if (!auth) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  let body: { action?: string; gbpUrl?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 }); }
  const action = body.action;

  // Re-verify the owner cookie against a real row BEFORE any write.
  const { data: listing, error: lookupErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .maybeSingle();
  if (lookupErr) return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  if (!listing) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const id = (listing as { id: string }).id;

  const pendKey = { source_table: LISTINGS_TABLE, listing_id: id };

  if (action === "approve") {
    const { data: pend } = await supabaseAdmin
      .from("listing_place_id_pending")
      .select("pending_place_id, pending_rating, pending_review_count, confirmed")
      .match(pendKey)
      .maybeSingle();
    if (!pend || !pend.pending_place_id) return NextResponse.json({ ok: false, error: "no_pending" }, { status: 404 });
    const { error: upErr } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({
        google_place_id: pend.pending_place_id,
        google_rating: pend.pending_rating,
        google_review_count: pend.pending_review_count,
      })
      .eq("id", id);
    if (upErr) {
      // google_place_id is UNIQUE. A collision means this Google listing is already linked to
      // ANOTHER listing. Log it (dedup-findable in place_id_collision_log) and tell the owner
      // clearly — WITHOUT exposing the other listing's identity. NO auto-merge, NO
      // possible_duplicate_of, NO dedup machinery: Terry rules on that separately.
      const isUnique = upErr.code === "23505" || /unique|duplicate key/i.test(upErr.message || "");
      if (isUnique) {
        const { data: existing } = await supabaseAdmin
          .from(LISTINGS_TABLE).select("id").eq("google_place_id", pend.pending_place_id).maybeSingle();
        await supabaseAdmin.from("place_id_collision_log").insert({
          source_table: LISTINGS_TABLE,
          vertical: process.env.BILLING_VERTICAL_SLUG ?? "legaladvice",
          attempting_listing_id: id,
          existing_listing_id: (existing as { id?: string } | null)?.id ?? null,
          place_id: pend.pending_place_id,
        }).then(() => {}, () => {});
        return NextResponse.json({
          ok: false,
          error: "already_linked",
          message: "That Google listing is already linked to another business in our directory. If it belongs to you, contact support and we'll get it sorted.",
        }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
    }
    await supabaseAdmin.from("listing_place_id_pending").update({ confirmed: true, updated_at: new Date().toISOString() }).match(pendKey);
    return NextResponse.json({ ok: true, status: "confirmed" });
  }

  if (action === "reject") {
    await supabaseAdmin.from("listing_place_id_pending").delete().match(pendKey);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (action === "edit") {
    const parsed = await normalizeGbpUrl(typeof body.gbpUrl === "string" ? body.gbpUrl : "");
    if (!parsed.ok || !parsed.gbp_place_id || !/^ChIJ/i.test(parsed.gbp_place_id)) {
      return NextResponse.json({ ok: false, error: "no_place_id", message: "Paste the Google Maps link for your business (it must resolve to a place)." }, { status: 400 });
    }
    const d = await proDetails(parsed.gbp_place_id);
    if (!d || d.status !== 200 || d.rating == null || d.count == null || d.count === 0) {
      return NextResponse.json({ ok: false, error: "no_render_values" }, { status: 422 });
    }
    await supabaseAdmin.from(LISTINGS_TABLE).update({ gbp_url: parsed.gbp_url }).eq("id", id);
    await supabaseAdmin.from("listing_place_id_pending").upsert({
      ...pendKey, vertical: process.env.BILLING_VERTICAL_SLUG ?? "legaladvice",
      pending_place_id: parsed.gbp_place_id, pending_rating: d.rating, pending_review_count: d.count, pending_name: d.name,
      confirmed: false, updated_at: new Date().toISOString(),
    }, { onConflict: "source_table,listing_id" });
    return NextResponse.json({ ok: true, status: "re_resolved", rating: d.rating, count: d.count, name: d.name });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
