import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { UK_TABLE } from "@/lib/uk-solicitors";
import { revalidateUkSlugs } from "@/lib/uk-revalidate";

export const dynamic = "force-dynamic";

// Verifies the magic-link token and flips the UK listing to Claimed (is_claimed=true). No payment, no
// owner cookie/dashboard this session (TODO(UK-PRICING) + owner dashboard are the
// deferred follow-up). On success -> firm page showing the Claimed badge.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const { data: firm, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select("id, owner_auth_token")
    .eq("id", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !firm || !firm.owner_auth_token || firm.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from(UK_TABLE)
    .update({ is_claimed: true, claimed_at: now, updated_at: now })
    .eq("id", firm.id);

  // ISR purge (K32 on-demand purge, 2026-08-24). This route mutates the row and then
  // redirects the owner ONTO the cached leaf. Without the purge they land on a copy that
  // can be up to 24h old and still says "Claim this listing" — the claim they just
  // completed appears not to have worked. Best-effort ONLY: the claim write above has
  // already committed, and a purge failure must never cost the claim.
  try {
    await revalidateUkSlugs([String(firm.id)]);
  } catch (e) {
    console.error(
      `[uk/claim/verify] revalidate failed for ${firm.id}:`,
      e instanceof Error ? e.message : e
    );
  }

  return NextResponse.redirect(`${siteUrl}/uk/directory/${firm.id}?claimed=1`);
}
