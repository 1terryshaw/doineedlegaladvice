import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies, getAuthorizedOwnerListing } from "@/lib/auth";
import { normalizeTierForPricing } from "@/lib/pricing-canonical";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const loggedOut = () => NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });

// This is deliberately separate from /api/owner/me. It supports legacy
// non-header consumers with the one listing encoded in the verified cookie;
// it never enumerates or chooses from a token's other controlled listings.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  const requestedListingSlug = new URL(request.url).searchParams.get("listingSlug");

  if (!auth || (requestedListingSlug && requestedListingSlug !== auth.slug)) {
    return loggedOut();
  }

  const listing = await getAuthorizedOwnerListing<{
    slug: string; tier: string | null; subscription_tier: string | null;
  }>(auth, "slug, tier, subscription_tier, owner_auth_token, owner_auth_token_expires_at, claimed");
  if (!listing) {
    return loggedOut();
  }

  return NextResponse.json({
    authenticated: true,
    slug: listing.slug,
    // getAuthorizedOwnerListing gates .eq(claimed,true), so this listing is always claimed → pass true.
    tier: normalizeTierForPricing(listing.tier || listing.subscription_tier || null, true),
  }, { headers: NO_CACHE_HEADERS });
}
