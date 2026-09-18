import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { laneOpen } from "@/lib/lane-gate";
import { validateSubmission } from "@/lib/lane-validate";
import { resolveRegion } from "@/lib/lane-region";
import { laneSlug } from "@/lib/lane-slug";
import { sha256, newSecret } from "@/lib/lane-crypto";
import { LANE_VERIFY_TTL_HOURS } from "@/lib/lane-session";
import { checkRateLimit, clientIp, RATE_LIMIT_MESSAGE } from "@/lib/lane-ratelimit";
import { routeCandidates, handoffCopy } from "@/lib/lane-dedup";
import { laneBotCheck, honeypotTripped, dwellTooFast } from "@/lib/lane-botid";
import { verificationMail, sendLaneMail } from "@/lib/lane-email";
import {
  cityObserved, findLaneCandidates, insertSubmission, laneEmailAudit, laneHistory,
  recentSubmissionsFromIp, laneSite,
} from "@/lib/lane-store";

export const dynamic = "force-dynamic";

/**
 * THE LANE INTAKE (spec §5.1).
 *
 * Order is the contract: bot check → parse/validate → honeypot → region gate → rate limit →
 * FINDER → mint → mail. Each step's refusal is its own code, and only the last two write.
 *
 * 🔴 THIS ROUTE DOES NOT WRAP ITSELF IN A MISSING-RELATION CATCH (§5.5). The two RENDER paths
 * do, because a public URL must not serve a stack trace between the deploy and the migration.
 * A POST must not: wrapping a write would risk reporting a FAILED WRITE AS A SUCCESS, and a
 * submitter told "check your email" for a row that does not exist is worse than an error.
 *
 * 🔴 IT MINTS NO CLAIM CREDENTIAL AND NEVER POSTS /api/claim. Outcomes 1–3 hand back a URL and
 * the client navigates; the submitter completes the claim themselves. The claim funnel's abuse
 * verdict, its token re-use rule, its attribution insert and its telemetry are entirely
 * unmodified by this lane's existence. There must be exactly one code path in the estate that
 * can mint a claim credential, and it is not this one.
 */
export async function POST(req: NextRequest) {
  if (!laneOpen()) return NextResponse.json({ error: "Not available." }, { status: 404 });

  // ── 1. BOT CHECK (L4). A refusal is audited but writes no submission row. ──
  const bot = await laneBotCheck();
  if (bot.refuse) {
    console.warn("[lane] intake refused: botid");
    return NextResponse.json({ error: "We couldn't verify this request. Please try again." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── 3. HONEYPOT (L1). 🔴 A REFUSAL THAT LOOKS LIKE SUCCESS. Same 200, same shape, and NO
  // row, NO mail. A refusal that announces itself teaches the next attempt which field to
  // leave alone — which is the entire value of a honeypot.
  if (honeypotTripped(body) || dwellTooFast(body.rendered_at, Date.now())) {
    console.warn("[lane] intake refused: honeypot/dwell (responding as success, writing nothing)");
    return NextResponse.json({ outcome: "no_match", ok: true, next: "/list-your-business/sent" });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const validated = validateSubmission({
    business_name: str("business_name"), contact_name: str("contact_name"),
    address_line: str("address_line"), city: str("city"), region_state: str("region_state"),
    postal_code: str("postal_code"), phone: str("phone"), website: str("website"),
    public_email: str("public_email"), description: str("description"),
    submitted_by_email: str("submitted_by_email"),
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.message, code: validated.code }, { status: 400 });
  }
  const v = validated.value;

  // ── 5. RATE LIMIT (L3). FAIL CLOSED: no client address ⇒ limited, never exempt. ──
  const ip = clientIp(req.headers);
  const limit = await checkRateLimit(ip, recentSubmissionsFromIp);
  if (!limit.allowed) {
    console.warn(`[lane] intake refused: ${limit.code}`);
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE, code: limit.code }, { status: 429 });
  }

  // ── 6. THE FINDER. Outcomes 1–3 WRITE NOTHING AT ALL — not even a history row, because
  // there is no submission to key one to. The outcome is counted in logs only. ──
  const found = await findLaneCandidates({
    name: v.business_name, phone: v.phone, website: v.website,
    address: v.address_line, postal_code: v.postal_code,
  });
  if (!found.ok) {
    // 🔴 FAIL CLOSED, AND THIS IS A DELIBERATE CHOICE WITH A STATED ALTERNATIVE. A finder
    // timeout that degraded to "no match" would MINT A NEW ROW for someone we may already
    // hold — a duplicate-identity generator. Refusing is recoverable; the submitter retries.
    console.error("[lane] intake refused: finder unavailable", found.code);
    return NextResponse.json(
      { error: "We couldn't check our records just now. Please try again shortly.", code: "FINDER_UNAVAILABLE" },
      { status: 503 },
    );
  }
  const routing = routeCandidates(found.rows, v.business_name);
  if (routing.outcome !== "no_match") {
    console.log(`[lane] intake handoff: ${routing.outcome} → ${routing.claim_url} (confident=${routing.confident} weak=${routing.weak} guard=${routing.guard_reason_code || "n/a"}) · 0 writes`);
    return NextResponse.json({
      outcome: routing.outcome,
      claim_url: routing.claim_url,
      copy: handoffCopy(routing.outcome),
      // Route 2's search is pre-filled so an ambiguous handoff is not a dead end.
      prefill: { q: v.business_name, city: v.city },
    });
  }

  // ── 7. MINT. The submission_id is generated HERE, before the INSERT, because the slug is
  // derived from it (§1.3) — no cross-table existence probe, and no second round trip.
  const submissionId = randomUUID();
  const slug = laneSlug(v.business_name, v.city, v.region_state, submissionId);
  const verifyToken = newSecret();
  const regionResolution = await resolveRegion(v.region_state, v.city, cityObserved);

  const inserted = await insertSubmission({
    submission_id: submissionId,
    site: laneSite(),
    business_name: v.business_name,
    contact_name: v.contact_name,
    address_line: v.address_line,
    city: v.city,
    region_state: v.region_state,
    postal_code: v.postal_code,
    // NOT read from the body — `validateSubmission` forces it and the CHECK enforces it.
    country: v.country,
    phone: v.phone,
    website: v.website,
    public_email: v.public_email,
    description: v.description,
    submitted_by_email: v.submitted_by_email,
    submitted_ip: ip,
    submitted_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
    // 🔴 ONLY THE DIGEST IS STORED. A SELECT on this table hands the reader no live credential.
    verify_token_sha256: sha256(verifyToken),
    verify_token_expires_at: new Date(Date.now() + LANE_VERIFY_TTL_HOURS * 3600_000).toISOString(),
    submission_status: "pending_verification",
    // is_published is NOT passed. Its DEFAULT is false and `lsl_publish_requires_verified`
    // makes publication structurally impossible before a mailbox is proven. An omitted column
    // here publishes NOTHING — which is the inverse of the directory table's own DEFAULT.
    finder_resolution: "NO_MATCH",
    region_resolution: regionResolution,
    bot_check: bot.botCheck,
    slug,
  });
  if (!inserted.ok) {
    console.error("[lane] insert failed:", inserted.code, inserted.message);
    return NextResponse.json({ error: "Could not save your listing. Please try again." }, { status: 500 });
  }

  await laneHistory({
    submission_id: submissionId, actor: "submitter", action: "created",
    to_status: "pending_verification", to_published: false,
    detail: `region=${regionResolution} bot=${bot.botCheck} candidates=${found.rows.length}`,
  });

  // ── 8. MAIL. K36: Resend RETURNS {data, error} and does not throw, so the result is checked
  // explicitly and audited. A failed send leaves the row `pending_verification`, which is
  // correct and recoverable via /resend — it is NOT an error the submitter can fix by
  // resubmitting, so we say so rather than 500ing a row that landed.
  const mail = verificationMail(v.submitted_by_email, v.business_name, verifyToken);
  const sent = await sendLaneMail(mail);
  await laneEmailAudit({
    submission_id: submissionId, recipient: v.submitted_by_email, transport: sent.transport,
    purpose: mail.purpose, accepted: sent.accepted, provider_status: sent.providerStatus,
  });
  if (!sent.accepted) console.error(`[lane] verification mail NOT accepted for ${submissionId}: ${sent.providerStatus}`);

  return NextResponse.json({
    outcome: "no_match",
    ok: true,
    next: "/list-your-business/sent",
    mail_accepted: sent.accepted,
  });
}
