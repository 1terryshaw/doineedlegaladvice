import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

// Shared compliance removal-request intake (empire-wide, stampable — identical per repo
// except REMOVAL_VERTICAL). A submission is a REQUEST that is human-reviewed; it does NOT
// instantly delist (that would let a competitor delist a rival). Approval → an admin runs
// scripts/removal-action.ts, which unpublishes the row (is_published=false → the page 404s,
// drops from the sitemap, and de-indexes). Writes ONLY removal_requests; never touches any
// claim/matcher column.
const REMOVAL_VERTICAL = "legal";
const PRIVACY_INBOX = "privacy@marketingteaminabox.com";
const NOTIFY_FROM = "notifications@smartwebsitemanagement.ca";

const RATE_LIMIT = 5; // max removal requests per IP / 24h

const NOTIFY_ATTEMPTS = 3;

/**
 * TDL #1059 (E2) — best-effort notify with an EXPLICIT error check and backoff.
 *
 * K36: Resend RETURNS `{ data, error }`; it does not throw. A `try/catch` around `.send()` is not
 * an error check, and that is exactly how a failed privacy-inbox notification became invisible.
 *
 * Returns true only if Resend accepted the message. Never throws — the caller must not fail the
 * request, because the durable row has already landed and the user's removal request is safe.
 */
async function notifyPrivacyInbox(req: {
  id: string;
  listingRef: string;
  listing_slug?: string | null;
  listing_id?: string | null;
  requester_email: string;
  reason?: string | null;
}): Promise<boolean> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const text = [
    `A removal request was submitted.`,
    ``,
    `Vertical:      ${REMOVAL_VERTICAL}`,
    `Listing slug:  ${req.listing_slug || "(none)"}`,
    `Listing id:    ${req.listing_id || "(none)"}`,
    `Requester:     ${req.requester_email}`,
    `Reason:        ${req.reason || "(none provided)"}`,
    `Request id:    ${req.id}`,
    ``,
    `Review, then run scripts/removal-action.ts to approve (unpublish) or deny.`,
  ].join("\n");

  for (let attempt = 1; attempt <= NOTIFY_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from: `Removal Requests <${NOTIFY_FROM}>`,
        to: PRIVACY_INBOX,
        replyTo: req.requester_email,
        subject: `Removal request — ${REMOVAL_VERTICAL} — ${req.listingRef}`,
        text,
      });
      if (!error) return true;
      console.error(
        `[removal-request] notify attempt ${attempt}/${NOTIFY_ATTEMPTS} FAILED for ${req.id}: ${error.message}`
      );
    } catch (e) {
      // A thrown error here is a transport fault (DNS, socket). Retry it too.
      console.error(
        `[removal-request] notify attempt ${attempt}/${NOTIFY_ATTEMPTS} THREW for ${req.id}:`,
        e instanceof Error ? e.message : e
      );
    }
    if (attempt < NOTIFY_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1))); // 300ms, 600ms
    }
  }
  return false;
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const requester_email = (body.requester_email || "").trim().toLowerCase();
  const reason = (body.reason || "").trim().slice(0, 2000) || null;
  const listing_slug = (body.listing_slug || "").trim().slice(0, 200) || null;
  const listing_id = (body.listing_id || "").trim().slice(0, 200) || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(requester_email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Light IP rate limit against form abuse.
  const ip = clientIp(req);
  if (ip) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("removal_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_email", requester_email)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) {
      return NextResponse.json(
        { error: "You have submitted several requests recently. We will review them shortly." },
        { status: 429 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("removal_requests")
    .insert({
      vertical: REMOVAL_VERTICAL,
      listing_id,
      listing_slug,
      requester_email,
      reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("removal-request insert failed:", error);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
  }

  // Notify the shared privacy inbox.
  //
  // TDL #1059 (E2) — the DURABLE RECORD IS THE QUEUE. The row above landed and is error-checked,
  // so the request is never lost; this email is the delivery of that request to a human, and it
  // was the one thing here that could fail silently. Two reasons it did:
  //
  //   1. K36 — Resend RETURNS `{ data, error }`. It does not throw. The try/catch below NEVER
  //      fired on a send failure, so a rejected send was indistinguishable from a delivered one.
  //   2. Nothing watched the outcome. On a data-removal request, a silently dropped notification
  //      IS the compliance breach — there is no other surface where a human sees it.
  //
  // So: check the error explicitly, retry with backoff, and on exhaustion leave the row `pending`
  // and shout. The row staying `pending` is what makes this safe without a queue system — the
  // Morning Report alerts on pending removal_requests (and on any older than 48h), so an
  // undelivered notification surfaces on the ops channel within a day. If a real queue is ever
  // warranted, this row is exactly what it would drain.
  const listingRef = listing_slug || listing_id || "(unspecified)";
  const notified = await notifyPrivacyInbox({
    id: data.id as string,
    listingRef,
    listing_slug,
    listing_id,
    requester_email,
    reason,
  });

  if (!notified) {
    console.error(
      `[removal-request] PRIVACY INBOX NOT NOTIFIED for request ${data.id} (${listingRef}) after ${NOTIFY_ATTEMPTS} attempts — ` +
        `row remains status=pending and WILL be surfaced by the Morning Report's pending-removals alert.`
    );
  }

  // The user is told the truth: the request is RECORDED either way (the row landed, or we would
  // have 500'd above). We never claim it was delivered when it was not.
  return NextResponse.json({
    ok: true,
    id: data.id,
    status: notified ? "received" : "recorded_pending_review",
  });
}
