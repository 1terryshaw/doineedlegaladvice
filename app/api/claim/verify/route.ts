import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";
import { signPlaceResolve } from "@/lib/billing-handoff";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════════
// GET DOES NOT WRITE. POST DOES. (recon-v1 §D step 4 · ruling R2 · fan 2026-09-11)
//
// This route used to expose the claim write — claimed=true, claimed_at, and (where the
// repo carries the #1068 republish guard) the is_published false→true flip — as a GET,
// and that GET's URL was what we MAILED to owners. Every link-safety rewriter, mail
// scanner and inbox link previewer that prefetches URLs in inbound mail was therefore
// able to complete a claim, and publish a listing, without the recipient ever opening
// the message. The resulting row is byte-identical to a genuine claim, so it cannot be
// told apart afterwards, let alone undone.
//
// The split below is the fix, and it is the plain HTTP contract: GET is safe, POST is
// not. GET now only redirects to /claim/verify, the interstitial page, carrying the same
// query string; the page shows the owner what they are about to claim and gives them one
// button, which POSTs here. A scanner following the mailed link lands on a page and
// stops. A human lands on the same page and clicks.
//
// TOKENS ALREADY IN THE WILD KEEP WORKING. The mailed URL is unchanged in shape and the
// token is unchanged in meaning — an owner holding a link from weeks ago follows it, gets
// bounced to the interstitial, and confirms. Nothing was invalidated.
//
// REDIRECTS FROM POST MUST BE 303, NOT 307. NextResponse.redirect() defaults to 307,
// which PRESERVES the method — the browser would re-POST to /owner/<slug> and to
// /claim/error, neither of which accepts a POST. 303 See Other is the status that turns a
// POST result into a GET of the destination. Every redirect on this path says 303
// explicitly for that reason; do not drop the argument.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // Zero reads, zero writes, zero DB access. Deliberately does NOT validate the token:
  // there is nothing to protect yet, and validating here would only duplicate the two
  // places that do it for real (the interstitial page, then POST below). Preserve the
  // query string verbatim so the interstitial sees exactly what was mailed.
  const { searchParams } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const qs = searchParams.toString();
  return NextResponse.redirect(`${siteUrl}/claim/verify${qs ? `?${qs}` : ""}`, 302);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Accept the interstitial's form post, and fall back to the query string so a POST
  // carrying its parameters either way behaves identically.
  let token = searchParams.get("token");
  let slug = searchParams.get("slug");
  try {
    const form = await request.formData();
    token = (form.get("token") as string | null) ?? token;
    slug = (form.get("slug") as string | null) ?? slug;
  } catch {
    // No body / not form-encoded — the query-string values above stand.
  }
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  // Every dead end here is a real owner holding a link that stopped working. Carry the slug
  // so /claim/error can hand them a fresh one rather than only a "back to directory" link.
  const claimError = (s?: string | null) =>
    `${siteUrl}/claim/error${s ? `?slug=${encodeURIComponent(s)}` : ""}`;

  if (!token || !slug) {
    return NextResponse.redirect(claimError(slug), 303);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, owner_auth_token_expires_at")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(claimError(slug), 303);
  }

  // Token expiry — enforced ONLY when set. Self-serve submissions stamp a 24h
  // owner_auth_token_expires_at; seeded/organic claim tokens leave it NULL and never expire,
  // so this cannot regress the pre-existing claim path. (claim-token-expiry-and-remint-v2)
  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(claimError(slug), 303);
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

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`, 303);
  setAuthCookie(response, token, slug);
  return response;
}
