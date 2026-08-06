import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import {
  controlledOwnerListingsFromRows,
  hasValidOwnerAuthorization,
  type ControlledOwnerListing,
  type OwnerAuthorizationListing,
} from "@/lib/owner-authorization";

export {
  controlledOwnerListingsFromRows,
  hasValidOwnerAuthorization,
  isOwnerTokenExpired,
  type ControlledOwnerListing,
} from "@/lib/owner-authorization";

const COOKIE_NAME = `${verticalConfig.tablePrefix}owner_token`;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type OwnerAuthorizationScope = { slug: string; token: string };

export function generateToken(): string {
  return randomUUID();
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  slug: string
): void {
  response.cookies.set(COOKIE_NAME, `${slug}:${token}`, {
    httpOnly: true,
    maxAge: MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function getAuthFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): OwnerAuthorizationScope | null {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const separatorIndex = cookie.value.indexOf(":");
  if (separatorIndex === -1) return null;
  const slug = cookie.value.substring(0, separatorIndex);
  const token = cookie.value.substring(separatorIndex + 1);
  if (!slug || !token) return null;
  return { slug, token };
}

// The one canonical database authorization path for owner-sensitive operations.
// It scopes to the cookie/requested listing before matching the opaque token, demands
// a claimed row, rejects every query cardinality error via `.single()`, and finally
// applies the shared expiry predicate (including malformed-expiry fail-closed logic).
export async function getAuthorizedOwnerListing<T extends object = Record<string, unknown>>(
  scope: OwnerAuthorizationScope,
  select = "*",
): Promise<T | null> {
  if (!scope.slug || !scope.token) return null;

  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select(select)
    .eq("slug", scope.slug)
    .eq("owner_auth_token", scope.token)
    .eq("claimed", true)
    .single();

  const listing = data as unknown as OwnerAuthorizationListing | null;
  if (error || !hasValidOwnerAuthorization(listing, scope.token)) return null;
  return data as unknown as T;
}

// A controlled listing is bound to the verified bearer token, never inferred
// from a matching email address. This supports a future/shared-token owner
// session without broadening authorization to unrelated rows.
export async function getControlledOwnerListings(token: string): Promise<ControlledOwnerListing[] | null> {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, name, business_name, owner_auth_token, owner_auth_token_expires_at, claimed")
    .eq("owner_auth_token", token)
    .eq("claimed", true)
    .order("slug");
  if (error || !data) return null;
  return controlledOwnerListingsFromRows(data, token);
}

export async function verifyOwnerAccess(slug: string): Promise<{ listing: any } | null> {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  if (!auth || auth.slug !== slug) return null;
  const listing = await getAuthorizedOwnerListing(auth);
  if (!listing) return null;
  return { listing };
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
