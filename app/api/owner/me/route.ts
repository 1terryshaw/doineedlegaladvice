import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);

  if (!auth) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  // Verify the token is still valid
  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, owner_email, tier, subscription_tier")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (error || !listing) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({
    authenticated: true,
    slug: listing.slug,
    ownerEmail: listing.owner_email,
    tier: listing.tier || listing.subscription_tier || null,
  }, { headers: NO_CACHE_HEADERS });
}
