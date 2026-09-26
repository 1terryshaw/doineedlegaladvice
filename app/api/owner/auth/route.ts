import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie, isOwnerTokenExpired } from "@/lib/auth";
import { logOwnerAuthEvent, recordSessionStart } from "@/lib/owner-events";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    await logOwnerAuthEvent("link_invalid", { slug, detail: "missing" });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, owner_auth_token_expires_at")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    await logOwnerAuthEvent("link_invalid", { slug, detail: "no_match" });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  // P4 (owner-funnel-recovery): an expired link used to set a cookie that every owner call then refused
  // (a silent sign-in loop). Send the owner straight to the login form for a fresh link instead.
  if (isOwnerTokenExpired(listing.owner_auth_token_expires_at as string | null)) {
    await logOwnerAuthEvent("link_expired", { slug });
    return NextResponse.redirect(`${siteUrl}/owner/login?error=expired`);
  }
  const reused = await recordSessionStart(slug, token);
  await logOwnerAuthEvent("link_clicked", { slug });
  await logOwnerAuthEvent(reused ? "link_reused" : "session_created", { slug });

  // Stamp owner activity (Phase 3 ranking signal)
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listing.id);

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
