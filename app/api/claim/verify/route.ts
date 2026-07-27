import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";
import { signPlaceResolve } from "@/lib/billing-handoff";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  // Mark as claimed
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ claimed_at: new Date().toISOString(), claimed: true, updated_at: new Date().toISOString() })
    .eq("id", listing.id);

  // ADDITIVE (two-tier display, spec v2) — fire-and-forget place-id resolve. Waits ONLY for
  // the endpoint's 202 ACK, hard-capped at 400ms, and swallows EVERYTHING. A resolution
  // failure must NEVER cost a claim: the claim write above is already committed and this
  // block cannot alter the response below. Endpoint does the Places call + email async.
  try {
    const base = process.env.BILLING_SERVICE_URL;
    const vslug = process.env.BILLING_VERTICAL_SLUG;
    if (base && vslug) {
      const jwt = await signPlaceResolve(String(listing.id), slug);
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 400);
      await fetch(`${base}/api/place-id/resolve`, {
        method: "POST",
        signal: ac.signal,
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ vertical: vslug, listing_id: listing.id, slug }),
      }).catch(() => {});
      clearTimeout(t);
    }
  } catch {
    /* swallow — the claim is already done; resolution is best-effort */
  }

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
