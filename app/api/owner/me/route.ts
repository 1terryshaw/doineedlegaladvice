import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies, getAuthorizedOwnerListing, getControlledOwnerListings, setAuthCookie } from "@/lib/auth";
import { touchOwnerSession } from "@/lib/owner-events";
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

  const listing = await getAuthorizedOwnerListing<{ slug: string; owner_auth_token_expires_at: string | null }>(auth, "slug, owner_auth_token, owner_auth_token_expires_at, claimed");
  if (!listing) {
    return NextResponse.json({ authenticated: false }, { headers: NO_CACHE_HEADERS });
  }
  // P4 sliding session: active use renews the token window (capped); a server-side revocation signs out.
  const session = await touchOwnerSession(auth.slug, auth.token, listing.owner_auth_token_expires_at);
  if (session === "revoked") {
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

  const response = NextResponse.json(displayState, { headers: NO_CACHE_HEADERS });
  if (session === "renewed") setAuthCookie(response, auth.token, auth.slug);
  return response;
}
