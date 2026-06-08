import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { sendClaimEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { slug, email, name } = await request.json();

    if (!slug || !email || !name) {
      return NextResponse.json(
        { success: false, error: "missing_fields", userMessage: "Please fill in all fields." },
        { status: 400 }
      );
    }

    const { data: listing, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, claimed, name")
      .eq("slug", slug)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { success: false, error: "not_found", userMessage: "We couldn't find that listing." },
        { status: 404 }
      );
    }

    if (listing.claimed) {
      return NextResponse.json(
        { success: false, error: "already_claimed", userMessage: "This listing has already been claimed." },
        { status: 400 }
      );
    }

    // TDL #510 P2.2: claim ownership verification — block free-email-domain claims on
    // corporate/professional-named listings + 72h same-listing cooling-off. Allowlist first;
    // fail-open on RPC error (don't block legit owners).
    try {
      const { data: cv } = await supabaseAdmin.rpc("abuse_claim_verdict", {
        p_email: email,
        p_listing_id: String(listing.id),
        p_listing_name: listing.name,
      });
      const verdict = cv as { blocked?: boolean; reason?: string } | null;
      if (verdict && verdict.blocked) {
        const userMessage =
          verdict.reason === "free_email_vs_corporate"
            ? "This listing looks like a registered business. To claim it, use an email at the business's own domain — or contact support to verify by phone."
            : verdict.reason === "cooling_off_72h"
              ? "You recently contacted this listing. For security, claiming is paused for 72 hours after an inquiry. Please try again later, or contact support."
              : "This claim can't be completed automatically. Please contact support.";
        return NextResponse.json(
          { success: false, error: "claim_blocked", reason: verdict.reason, userMessage },
          { status: 403 }
        );
      }
    } catch (e) {
      console.error("[abuse] claim verdict failed (fail-open):", e instanceof Error ? e.message : e);
    }

    const token = generateToken();

    // Send the verification email FIRST — if it fails we don't leave an
    // orphan owner_auth_token / owner_email on the row.
    const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");
    const emailFailed = NextResponse.json(
      {
        success: false,
        error: "email_send_failed",
        userMessage:
          "We're having trouble sending the verification email right now. Please try again in a few minutes.",
      },
      { status: 503 }
    );
    try {
      const result = await sendClaimEmail(email, slug, token);
      if (!result.ok) {
        console.error(
          JSON.stringify({ event: "claim_send_error", email_redacted: emailRedacted, slug, err: result.error })
        );
        return emailFailed;
      }
      console.log(
        JSON.stringify({ event: "claim_send_ok", email_redacted: emailRedacted, slug, resend_id: result.id })
      );
    } catch (emailErr) {
      console.error(
        JSON.stringify({ event: "claim_send_error", email_redacted: emailRedacted, slug, err: String(emailErr) })
      );
      return emailFailed;
    }

    const { error: updateError } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ owner_auth_token: token, owner_email: email })
      .eq("id", listing.id);

    if (updateError) {
      console.error("[claim] db write failed after email sent:", updateError.message);
      return NextResponse.json(
        {
          success: false,
          error: "db_write_failed",
          userMessage:
            "We sent your verification email but hit a snag finishing the claim. Please try again — if it persists, contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (unexpectedErr) {
    console.error("[claim] unexpected error:", unexpectedErr instanceof Error ? unexpectedErr.message : unexpectedErr);
    return NextResponse.json(
      {
        success: false,
        error: "unexpected",
        userMessage: "Something went wrong on our end. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
