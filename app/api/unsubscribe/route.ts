import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "../../../lib/supabase";
import { suppressEmail } from "@/lib/suppression";

// Dual-mode unsubscribe endpoint. One source of truth — stamped into every
// empire directory by gmail-triage/loop-fix-unsub.sh. Two unrelated unsubscribe
// flows historically collided on this path; this route handles both by the
// params present:
//   ?token=&email=   cold-outreach unsubscribe  -> outreach_unsubscribed = true
//   ?slug=&token=    owner-notification unsub   -> owner_email cleared
// See gmail-triage/unsub-audit-results-2026-05-21.md.

export const dynamic = "force-dynamic";

// TDL #472 claim-pitch unsubscribe -> central public.email_suppressions (the source
// isSuppressed() reads). Unsigned email param, per the signed-off doineedapro baseline.
async function suppressPitch(email: string): Promise<boolean> {
  const res = await suppressEmail(email, "claim_pitch_unsubscribe", "claim_pitch_one_click");
  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ outreach_unsubscribed: true })
    .eq("email", email)
    .then(undefined, () => undefined);
  return res.ok;
}

function page(title: string, body: string, status: number) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center">` +
      `<h1>${title}</h1>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const slug = searchParams.get("slug");
  const scope = searchParams.get("scope");

  // Claim-pitch unsubscribe (TDL #472): ?email=u-<addr>&scope=pitch -> email_suppressions
  // (the "u-" is the QP-hardening marker added in lib/resend.ts; strip exactly one).
  if (scope === "pitch" && email) {
    await suppressPitch(email.replace(/^u-/, ""));
    return page(
      "You have been unsubscribed",
      "<p>You will not receive any more listing-claim emails from us at this address.</p>" +
        "<p>If this was a mistake, reply to terry@marketingteaminabox.com</p>",
      200
    );
  }

  // Cold-outreach unsubscribe: ?token=&email=  ->  outreach_unsubscribed = true
  if (token && email) {
    await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ outreach_unsubscribed: true })
      .eq("outreach_unsub_token", token)
      .eq("email", email);
    return page(
      "You have been unsubscribed",
      "<p>You will not receive any more emails from us about this listing.</p>" +
        "<p>If this was a mistake, reply to terry@marketingteaminabox.com</p>",
      200
    );
  }

  // Owner-notification unsubscribe: ?slug=&token=  ->  owner_email cleared
  if (token && slug) {
    const { data: listing, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, owner_auth_token")
      .eq("slug", slug)
      .single();
    if (error || !listing || listing.owner_auth_token !== token) {
      return page("Invalid unsubscribe link", "<p>This link is no longer valid.</p>", 403);
    }
    await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ owner_email: null })
      .eq("id", listing.id);
    return page(
      "Unsubscribed",
      "<p>You will no longer receive inquiry notifications for this listing.</p>",
      200
    );
  }

  return page(
    "Invalid unsubscribe link",
    "<p>This link is missing required parameters. " +
      "Contact terry@marketingteaminabox.com for help.</p>",
    400
  );
}


// RFC 8058 one-click unsubscribe — mail clients POST here when honoring the
// List-Unsubscribe-Post: List-Unsubscribe=One-Click header on claim-pitch CEMs.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const ok = await suppressPitch(email.replace(/^u-/, ""));
  return NextResponse.json({ success: ok });
}
