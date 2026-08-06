import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { UK_TABLE } from "@/lib/uk-solicitors";
import { generateToken } from "@/lib/auth";
import { sendUkClaimEmail } from "@/lib/uk-claim-email";

export const dynamic = "force-dynamic";

// PARALLEL UK claim flow — operates ONLY on uk_accountants. Free "Claimed" badge via
// magic-link control verification; no payment (TODO(UK-PRICING) for the GBP tiers).
export async function POST(request: NextRequest) {
  try {
    const { slug, email, name } = await request.json();

    if (!slug || !email || !name) {
      return NextResponse.json(
        { success: false, error: "missing_fields", userMessage: "Please fill in all fields." },
        { status: 400 }
      );
    }

    const { data: firm, error } = await supabaseAdmin
      .from(UK_TABLE)
      .select("id, is_claimed, business_name, company_number")
      .eq("id", String(slug))
      .eq("is_published", true)
      .maybeSingle();

    if (error || !firm) {
      return NextResponse.json(
        { success: false, error: "not_found", userMessage: "We couldn't find that listing." },
        { status: 404 }
      );
    }

    if (firm.is_claimed) {
      return NextResponse.json(
        { success: false, error: "already_claimed", userMessage: "This listing has already been claimed." },
        { status: 400 }
      );
    }

    const token = generateToken();
    const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");

    // Smoke suppression (mirrors #455): never dispatch real mail for test traffic.
    const suppressed = process.env.SMOKE_TEST === "1" || /ukclaimcanary|tdl455canary/i.test(String(email));

    if (!suppressed) {
      // Send the verification email FIRST so a failed send leaves no orphan token.
      const result = await sendUkClaimEmail(String(email), String(firm.id), token, firm.business_name);
      if (!result.ok) {
        console.error(JSON.stringify({ event: "uk_claim_send_error", email_redacted: emailRedacted, slug, err: result.error }));
        return NextResponse.json(
          {
            success: false,
            error: "email_send_failed",
            userMessage: "We're having trouble sending the verification email right now. Please try again in a few minutes.",
          },
          { status: 503 }
        );
      }
      console.log(JSON.stringify({ event: "uk_claim_send_ok", email_redacted: emailRedacted, slug, resend_id: result.id }));
    } else {
      console.log(`[SMOKE] would-send: sendUkClaimEmail -> ${emailRedacted} (suppressed)`);
    }

    const { error: updateError } = await supabaseAdmin
      .from(UK_TABLE)
      .update({ owner_auth_token: token, owner_email: String(email), owner_name: String(name) })
      .eq("id", firm.id);

    if (updateError) {
      console.error("[uk-claim] db write failed after email sent:", updateError.message);
      return NextResponse.json(
        {
          success: false,
          error: "db_write_failed",
          userMessage: "We sent your verification email but hit a snag finishing the claim. Please try again — if it persists, contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, suppressed });
  } catch (unexpectedErr) {
    console.error("[uk-claim] unexpected error:", unexpectedErr instanceof Error ? unexpectedErr.message : unexpectedErr);
    return NextResponse.json(
      { success: false, error: "unexpected", userMessage: "Something went wrong on our end. Please try again in a moment." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "POST a JSON body { slug, email, name } to claim a UK listing." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
