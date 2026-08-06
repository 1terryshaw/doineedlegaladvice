import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies, getAuthorizedOwnerListing, getControlledOwnerListings } from "@/lib/auth";
import type { OwnerDisplayState } from "@/lib/header-navigation";

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

  const listing = await getAuthorizedOwnerListing<{ slug: string }>(auth, "slug, owner_auth_token, owner_auth_token_expires_at, claimed");
  if (!listing) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  const controlledListings = await getControlledOwnerListings(auth.token);
  // A partial/failed display query is authentication uncertainty, not a reason
  // to retain stale owner navigation on a public page.
  if (!controlledListings) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }

  const listingCount = controlledListings.length;
  const displayState: OwnerDisplayState = listingCount === 1
    ? {
        authenticated: true,
        listingCount,
        primaryListingSlug: controlledListings[0].slug,
      }
    : {
        authenticated: true,
        listingCount,
      };

  return NextResponse.json(displayState, { headers: NO_CACHE_HEADERS });
}
