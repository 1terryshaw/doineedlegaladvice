import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { sendMagicLink } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { data: listings, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, owner_auth_token, owner_email")
    .eq("owner_email", email)
    .eq("claimed", true);

  if (error || !listings || listings.length === 0) {
    // Return success even if not found to prevent email enumeration
    return NextResponse.json({ success: true });
  }

  // Send magic link for the first claimed listing
  const listing = listings[0];
  try {
    await sendMagicLink(email, listing.slug, listing.owner_auth_token);
  } catch (err) {
    console.error("Login email failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
