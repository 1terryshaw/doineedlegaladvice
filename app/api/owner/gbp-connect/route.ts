import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getAuthFromCookies, getAuthorizedOwnerListing } from "@/lib/auth";
import { GBP_OWNER_MESSAGES, resolveGoogleBusinessProfileUrl } from "@/lib/gbp-connector";
import { LISTINGS_TABLE, supabaseAdmin } from "@/lib/supabase";

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
    return NextResponse.json({ ok: false, error: resolution.code, message: GBP_OWNER_MESSAGES[resolution.code] }, { status: 400 });
  }

  const { error: updateError, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ google_place_id: resolution.placeId, gbp_url: resolution.normalizedUrl }, { count: "exact" })
    .eq("id", listing.id)
    .eq("owner_auth_token", auth.token)
    .eq("claimed", true);
  if (updateError || count !== 1) {
    if (updateError) console.error("[owner/gbp-connect] restricted write failed", updateError.code);
    return NextResponse.json({ ok: false, error: "connection_not_saved", message: "We could not save the connection. Please try again." }, { status: 500 });
  }

  try {
    revalidatePath(`/owner/${listing.slug}`);
    revalidatePath(`/directory/${listing.slug}`);
    revalidateTag(`listing:${listing.slug}`);
  } catch (error) {
    console.error("[owner/gbp-connect] cache invalidation failed", error instanceof Error ? error.name : "unknown");
  }
  return NextResponse.json({ ok: true, placeId: resolution.placeId, gbpUrl: resolution.normalizedUrl, mode: resolution.mode });
}
