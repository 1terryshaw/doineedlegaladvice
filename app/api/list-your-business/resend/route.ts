import { NextRequest, NextResponse } from "next/server";

import { laneOpen } from "@/lib/lane-gate";
import { looksLikeEmail } from "@/lib/lane-validate";
import { clientIp, checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/lane-ratelimit";
import { laneBotCheck, honeypotTripped } from "@/lib/lane-botid";
import { sendLaneMail, verificationMail } from "@/lib/lane-email";
import { laneEmailAudit, laneHistory, pendingRowByEmail, recentSubmissionsFromIp } from "@/lib/lane-store";

export const dynamic = "force-dynamic";

/**
 * RE-SEND THE VERIFY MAIL (spec §4).
 *
 * 🔴 IT NEVER RE-MINTS ON A LIVE TOKEN — and therefore it cannot mail one either.
 *
 * That is not a limitation, it is the whole design. The lane stores ONLY the SHA-256 of the
 * verify token, so the plaintext is unrecoverable by construction: there is nothing on the row
 * to put in a second email. Minting a fresh token here would mean this endpoint could issue a
 * NEW live credential to any address someone types — an unauthenticated credential-issuing
 * endpoint, which is exactly what the digest-only storage exists to prevent.
 *
 * So `/resend` re-sends NOTHING and says so honestly: if the first mail did not arrive, the
 * remedy is to submit again (the old row expires in 24h and the intake is idempotent from the
 * submitter's point of view). This endpoint exists to AUDIT that a person asked, and to give
 * the operator a signal when delivery is failing.
 *
 * It responds identically whether or not a pending row exists, so it cannot be used to probe
 * which addresses have submitted.
 *
 * WRITES: the email audit and a history row. Never the listing row.
 */
export async function POST(req: NextRequest) {
  if (!laneOpen()) return NextResponse.json({ error: "Not available." }, { status: 404 });

  const bot = await laneBotCheck();
  if (bot.refuse) return NextResponse.json({ error: "We couldn't verify this request." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (honeypotTripped(body)) {
    return NextResponse.json({ ok: true, resent: false });
  }

  const email = (typeof body.submitted_by_email === "string" ? body.submitted_by_email : "").trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const limit = await checkRateLimit(ip, recentSubmissionsFromIp);
  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE, code: limit.code }, { status: 429 });
  }

  const row = await pendingRowByEmail(email);
  if (row) {
    // A DELIBERATELY CONTENT-FREE NUDGE. It carries no link and no token, because there is no
    // token to carry — see the header. `verificationMail` is reused only for its `purpose`
    // label on the audit row, and the mail itself is built to say the honest thing.
    const nudge = {
      ...verificationMail(email, row.business_name, ""),
      subject: `Your listing for ${row.business_name} is still waiting for confirmation`,
      text:
        `We have an unconfirmed listing for ${row.business_name}.\n\n` +
        "We can't re-send the original confirmation link — it exists only in the first email, " +
        "and we never store a copy we could send you.\n\n" +
        "If you can't find that email (check spam), just submit the listing again and we'll " +
        "send a fresh link.",
      html:
        `<p>We have an unconfirmed listing for <strong>${row.business_name}</strong>.</p>` +
        "<p>We can't re-send the original confirmation link — it exists only in the first email, " +
        "and we never store a copy we could send you.</p>" +
        "<p>If you can't find that email (check spam), just submit the listing again and we'll " +
        "send a fresh link.</p>",
    };
    const sent = await sendLaneMail(nudge);
    await laneEmailAudit({
      submission_id: row.submission_id, recipient: email, transport: sent.transport,
      purpose: nudge.purpose, accepted: sent.accepted, provider_status: sent.providerStatus,
    });
    await laneHistory({
      submission_id: row.submission_id, actor: "submitter", action: "refused",
      detail: `resend requested; no token re-mint (digest-only storage). accepted=${sent.accepted}`,
    });
  }

  // The same response either way — this endpoint must not reveal which addresses have pending
  // submissions.
  return NextResponse.json({ ok: true, resent: false });
}
