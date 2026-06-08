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
  const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");
  try {
    const result = await sendMagicLink(email, listing.slug, listing.owner_auth_token);
    if (result.ok) {
      console.log(
        JSON.stringify({
          event: "owner_login_send_ok",
          email_redacted: emailRedacted,
          slug: listing.slug,
          resend_id: result.id,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          event: "owner_login_send_error",
          email_redacted: emailRedacted,
          slug: listing.slug,
          err: result.error,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "owner_login_send_error",
        email_redacted: emailRedacted,
        slug: listing.slug,
        err: String(err),
      })
    );
  }
  // Anti-enumeration: behavior to the user is unchanged regardless of send outcome.
  return NextResponse.json({ success: true });
}
