import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { UK_TABLE } from "@/lib/uk-solicitors";
import { generateToken } from "@/lib/auth";
import { sendUkClaimEmail } from "@/lib/uk-claim-email";
import { checkUkClaimRate, createUkPendingClaim, deleteUkPendingClaim } from "@/lib/uk-claim-guard";

export const dynamic = "force-dynamic";

const ALERT_MODULE = "uk-claim";
const ALERT_REPO = "doineedlegaladvice";

async function alertUkClaimFailure(title: string, details: Record<string, unknown>) {
  try {
    const { error } = await supabaseAdmin.from("sentinel_alerts").insert({
      severity: "high",
      module: ALERT_MODULE,
      repo: ALERT_REPO,
      title,
      details,
      status: "open",
    });
    if (error) console.error(`[uk-claim] sentinel_alerts insert failed: ${error.message}`);
  } catch (e) {
    console.error(`[uk-claim] sentinel_alerts insert threw: ${e instanceof Error ? e.message : e}`);
  }
}

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

    // Smoke suppression (mirrors #455): never dispatch real mail for test traffic.
    const suppressed = process.env.SMOKE_TEST === "1" || /ukclaimcanary|tdl455canary/i.test(String(email));

    // D8 claim limiter (3/email/h, 10/email/day, 20/IP/h). A throttled request gets the byte-identical
    // success body, so the response never says whether the caller was throttled. Errors FAIL OPEN and
    // raise a sentinel alert.
    const rate = await checkUkClaimRate(email, request);
    if (rate.error) {
      console.error(JSON.stringify({ event: "uk_claim_ratelimit_error", err: rate.error }));
      await alertUkClaimFailure(`UK claim rate limiter error on ${UK_TABLE}`, {
        table: UK_TABLE,
        error: rate.error,
        impact: "limiter failed OPEN — UK claim proceeds unthrottled until fixed",
      });
    } else if (!rate.allowed) {
      console.log(JSON.stringify({ event: "uk_claim_throttled", table: UK_TABLE }));
      return NextResponse.json({ success: true, suppressed });
    }

    const token = generateToken();
    const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");

    // D8: the unverified claim is stored in uk_claim_pending (token as sha256), NEVER on the listing
    // row. It is persisted BEFORE the send so we never mail a token the DB does not hold (#1059);
    // owner_auth_token/owner_email/owner_name reach the row only at a successful verify.
    const pending = await createUkPendingClaim(UK_TABLE, String(firm.id), token, String(email), String(name));
    if (!pending.ok) {
      console.error("[uk-claim] pending claim write failed:", pending.error);
      return NextResponse.json(
        { success: false, error: "db_write_failed", userMessage: "Something went wrong on our end. Please try again in a moment." },
        { status: 500 }
      );
    }

    if (!suppressed) {
      const result = await sendUkClaimEmail(String(email), String(firm.id), token, firm.business_name);
      if (!result.ok) {
        console.error(JSON.stringify({ event: "uk_claim_send_error", email_redacted: emailRedacted, slug, err: result.error }));
        await deleteUkPendingClaim(pending.id);
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
