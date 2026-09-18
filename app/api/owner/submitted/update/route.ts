import { NextRequest, NextResponse } from "next/server";

import { laneOpen } from "@/lib/lane-gate";
import {
  authoriseLane, clearLaneCookies, loadLaneSession, LANE_SESSION_COOKIE,
} from "@/lib/lane-session";
import { normalizeWebsiteUrl, looksLikeEmail } from "@/lib/lane-validate";
import { sendLaneMail, withdrawnMail } from "@/lib/lane-email";
import {
  laneEmailAudit, laneHistory, laneSessionByDigest, ownerUpdateSubmission, withdrawSubmission,
  OWNER_EDITABLE_FIELDS,
} from "@/lib/lane-store";

export const dynamic = "force-dynamic";

/**
 * THE LANE OWNER'S OWN WRITE PATH — allow-listed edits, and withdrawal (spec §7.3, R-7a).
 *
 * Authorised by the LANE session cookie + a CSRF secret from the request BODY. The lane's
 * cookies are its own (`dinla_submitted_*`), and this surface lives outside `/owner/[slug]`,
 * so a lane session can never be presented to the directory's owner routes and vice versa.
 */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const secure = new URL(req.url).protocol === "https:";
  if (!laneOpen()) return NextResponse.json({ error: "Not available." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body: Record<string, string> = {};
  // `Array.from` rather than `for…of` over the iterator: this tsconfig targets a level
  // below es2015 downlevel-iteration, and a spread over a FormData iterator does not compile.
  Array.from(form.entries()).forEach(([k, val]) => { body[k] = typeof val === "string" ? val : ""; });

  const lookup = await loadLaneSession(req.cookies.get(LANE_SESSION_COOKIE)?.value, {
    bySecretDigest: laneSessionByDigest,
  });
  if (!lookup.ok) {
    return NextResponse.redirect(`${origin}/owner/submitted/unknown?error=${encodeURIComponent(lookup.code)}`, 303);
  }

  // 🔴 THE CSRF SECRET COMES FROM THE BODY, AND ONLY FROM THE BODY.
  //
  // A double-submit check works only because its two halves arrive over two channels an
  // attacker cannot both control: the cookie the browser attaches automatically, and a field
  // the page had to be READ to obtain. `body.csrf ?? cookie(LANE_CSRF_COOKIE)` collapses that
  // to ONE channel — with no `csrf` field the handler would read the secret from the cookie
  // and compare it to the digest of the same cookie, and it would ALWAYS MATCH. That exact
  // defect shipped on the donor plane and a unit test could not see it, because
  // `authoriseLane()` is correct in isolation. PS-L7 asserts this call site.
  const csrfPresented = body.csrf ?? "";
  const auth = authoriseLane(lookup, lookup.submissionId, csrfPresented);
  if (!auth.ok) {
    console.warn(`[lane] owner update refused: ${auth.code}`);
    return NextResponse.redirect(`${origin}/owner/submitted/${lookup.slug}?error=${encodeURIComponent(auth.code)}`, 303);
  }

  // ── WITHDRAWAL ──
  if (body.action === "withdraw") {
    const row = await withdrawSubmission(lookup.submissionId);
    if (!row) return NextResponse.redirect(`${origin}/owner/submitted/${lookup.slug}?error=withdraw_failed`, 303);
    await laneHistory({
      submission_id: row.submission_id, actor: "owner", action: "withdrawn",
      from_status: "verified", to_status: "withdrawn", from_published: true, to_published: false,
      detail: "owner withdrawal; session revoked in the same statement",
    });
    const mail = withdrawnMail(row.submitted_by_email, row.business_name);
    const sent = await sendLaneMail(mail);
    await laneEmailAudit({
      submission_id: row.submission_id, recipient: row.submitted_by_email, transport: sent.transport,
      purpose: mail.purpose, accepted: sent.accepted, provider_status: sent.providerStatus,
    });
    const res = NextResponse.redirect(`${origin}/list-your-business?withdrawn=1`, 303);
    clearLaneCookies(res, secure);
    return res;
  }

  // ── EDIT — ALLOW-LISTED FIELDS ONLY ──
  //
  // 🔴 `business_name` IS NOT ON THE LIST, and a forged one in the body must not apply. The
  // name is the identity the submitter proved control of a mailbox FOR; letting an owner
  // session rewrite it turns that session into a rename primitive. The filtering is applied
  // TWICE — once here, once in the store's own `OWNER_EDITABLE_FIELDS` pass — because the
  // route builds the patch and the store is the last thing before the database.
  const patch: Record<string, unknown> = {};
  for (const field of OWNER_EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const raw = (body[field] ?? "").trim();
    if (field === "website") {
      const site = normalizeWebsiteUrl(raw);
      if (!site.ok) return NextResponse.redirect(`${origin}/owner/submitted/${lookup.slug}?error=website_invalid`, 303);
      patch.website = site.url;
      continue;
    }
    if (field === "public_email") {
      if (raw !== "" && !looksLikeEmail(raw)) {
        return NextResponse.redirect(`${origin}/owner/submitted/${lookup.slug}?error=public_email_invalid`, 303);
      }
      patch.public_email = raw === "" ? null : raw.toLowerCase();
      continue;
    }
    patch[field] = raw === "" ? null : raw.slice(0, 2000);
  }

  const updated = await ownerUpdateSubmission(lookup.submissionId, patch);
  if (!updated) return NextResponse.redirect(`${origin}/owner/submitted/${lookup.slug}?error=update_failed`, 303);
  await laneHistory({
    submission_id: updated.submission_id, actor: "owner", action: "edited",
    detail: `fields=${Object.keys(patch).join(",")}`,
  });
  return NextResponse.redirect(`${origin}/owner/submitted/${updated.slug}?saved=1`, 303);
}
