import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie, isOwnerTokenExpired } from "@/lib/auth";
import { logOwnerAuthEvent, recordSessionStart } from "@/lib/owner-events";
import { isOwnerSessionRevoked } from "@/lib/owner-session-guard";
import { parseUpgradeIntent, intentQuery, intentLinkSuffix } from "@/lib/upgrade-intent";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  // TDL #1369: a mailed magic link carries the Leads Plus choice; hand it to the dashboard (and keep it on a
  // bounce to the login form) so the checkout opens in whatever browser opened the e-mail.
  const lpIntent = parseUpgradeIntent((k) => searchParams.get(k));

  if (!token || !slug) {
    await logOwnerAuthEvent("link_invalid", { slug, detail: "missing" });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid${intentLinkSuffix(lpIntent)}`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, owner_auth_token_expires_at")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    await logOwnerAuthEvent("link_invalid", { slug, detail: "no_match" });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid${intentLinkSuffix(lpIntent)}`);
  }

  // P4 (owner-funnel-recovery): an expired link used to set a cookie that every owner call then refused
  // (a silent sign-in loop). Send the owner straight to the login form for a fresh link instead.
  if (isOwnerTokenExpired(listing.owner_auth_token_expires_at as string | null)) {
    await logOwnerAuthEvent("link_expired", { slug });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=expired${intentLinkSuffix(lpIntent)}`);
  }
  // owner-auth-hardening: a server-side-revoked session never gets a cookie here.
  if (await isOwnerSessionRevoked(token, slug)) {
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid${intentLinkSuffix(lpIntent)}`);
  }
  const reused = await recordSessionStart(slug, token);
  await logOwnerAuthEvent("link_clicked", { slug });
  await logOwnerAuthEvent(reused ? "link_reused" : "session_created", { slug });

  // Stamp owner activity (Phase 3 ranking signal)
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listing.id);

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}${lpIntent ? `?${intentQuery(lpIntent)}` : ""}`);
  setAuthCookie(response, token, slug);
  return response;
}
