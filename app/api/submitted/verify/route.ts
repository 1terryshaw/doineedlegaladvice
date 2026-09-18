import { NextRequest, NextResponse } from "next/server";

import { laneOpen } from "@/lib/lane-gate";
import { sha256, newSecret } from "@/lib/lane-crypto";
import { setLaneCookies, LANE_SESSION_TTL_HOURS } from "@/lib/lane-session";
import { liveMail, sendLaneMail } from "@/lib/lane-email";
import { bumpVerifyFailure, consumeVerifyAndPublish, laneEmailAudit, laneHistory } from "@/lib/lane-store";

export const dynamic = "force-dynamic";

/**
 * CONSUME THE VERIFY CREDENTIAL AND PUBLISH (spec §4.1).
 *
 * ── 🔴 THE GET/POST SPLIT IS MANDATORY, AND IT IS THIS REPO'S OWN HARD-WON LESSON ────
 * `app/api/claim/verify/route.ts:8-34` records why: the mailed link used to be a GET that
 * WROTE, so corporate link-safety rewriters and inbox previewers completed claims on
 * recipients' behalf, and the resulting row was indistinguishable from a genuine claim. The
 * lane's mailed link is `/submitted/verify?token=…` — A PAGE — and the write happens only on
 * this POST, which a human has to click.
 *
 * ── 303, NOT 307 ────────────────────────────────────────────────────────────────────
 * A 307 preserves the METHOD, so the browser would re-POST to the destination page. 303 is
 * what turns a POST into a GET of the result, which is what "redirect out of a form" means.
 * The same note this repo's claim route carries.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const secure = url.protocol === "https:";
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/submitted/verify?error=${encodeURIComponent(reason)}`, 303);

  if (!laneOpen()) return NextResponse.json({ error: "Not available." }, { status: 404 });

  // The token arrives as a form field (the interstitial is a plain server-rendered <form>, so
  // the whole flow works with JavaScript disabled) or as JSON.
  let token = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      token = typeof body.token === "string" ? body.token : "";
    } else {
      const form = await req.formData();
      token = String(form.get("token") ?? "");
    }
  } catch {
    return fail("invalid");
  }
  if (token.trim() === "") return fail("missing");

  const digest = sha256(token);
  const sessionSecret = newSecret();
  const csrfSecret = newSecret();

  // 🔴 ONE STATEMENT: consume → verified → published → session. The CHECK constraints
  // `lsl_publish_requires_verified` and `lsl_published_has_timestamp` can never be transiently
  // false, and a SECOND consume of the same token matches ZERO ROWS — the token is nulled in
  // the same update, so the replay is not "detected", it is impossible.
  const row = await consumeVerifyAndPublish({
    digest, sessionDigest: sha256(sessionSecret), csrfDigest: sha256(csrfSecret),
    sessionTtlHours: LANE_SESSION_TTL_HOURS,
  });

  if (!row) {
    // The counter is bumped and THE ROW'S LIFECYCLE IS NOT TOUCHED. A failed consume must not
    // be able to move a listing's state in any direction.
    await bumpVerifyFailure(digest);
    console.warn("[lane] verify: token did not match a live pending row (expired, replayed, or unknown)");
    return fail("expired");
  }

  await laneHistory({
    submission_id: row.submission_id, actor: "verify", action: "verified",
    from_status: "pending_verification", to_status: "verified",
    from_published: false, to_published: true, detail: "email verified; published",
  });

  const ownerPath = `/owner/submitted/${row.slug}`;
  const mail = liveMail(row.submitted_by_email, row.business_name, row.slug, ownerPath);
  const sent = await sendLaneMail(mail);
  await laneEmailAudit({
    submission_id: row.submission_id, recipient: row.submitted_by_email, transport: sent.transport,
    purpose: mail.purpose, accepted: sent.accepted, provider_status: sent.providerStatus,
  });

  const res = NextResponse.redirect(`${origin}${ownerPath}?verified=1`, 303);
  // The session is minted in the same statement that published the row, so there is no window
  // in which the listing is live but unowned.
  setLaneCookies(res, { sessionSecret, csrfSecret, secure });
  return res;
}

/**
 * 🔴 GET IS EXPLICITLY NOT A WRITER, AND SAYS SO.
 *
 * Without this handler a GET would 405, which is fine — but a future edit that "adds GET for
 * convenience" is exactly the regression this route exists to prevent. Making the refusal
 * explicit, with the reason attached, is cheaper than remembering.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/submitted/verify?error=use_the_button`, 303);
}
