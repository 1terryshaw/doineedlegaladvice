// leads-plus-canary-v1 — public Leads Plus lead submit. The page only renders the form behind
// leadFormGate(); this route RE-CHECKS the same gate server-side (a crafted POST to a free,
// unclaimed or canary-off listing is refused), stores the lead, then emails the owner.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { shouldSilentDrop } from "@/lib/inquiry-guard";
import {
  leadFormGate, splitContact, leadSubject, hashIp, isTestContext,
  BUDGET_OPTIONS, TIMING_OPTIONS, LEADS_TABLE, RATE_LIMIT,
} from "@/lib/leads-plus";
import { getGateRow, sendLeadNotification, isAddressUndeliverable } from "@/lib/leads-plus-server";
import { isValidEmail } from "@/lib/inquiry-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  listingSlug?: string; name?: string; contact?: string; need?: string; details?: string;
  service?: string; budget?: string; timing?: string; mode?: string;
  honeypot?: string; renderedAt?: number;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Spam layer 1: honeypot / sub-2.5s submit → silent success, nothing stored or sent.
  if (shouldSilentDrop({ honeypot: body.honeypot, renderedAt: body.renderedAt })) {
    return NextResponse.json({ success: true });
  }

  const slug = str(body.listingSlug, 200);
  const name = str(body.name, 120);
  const need = str(body.need, 300);
  const details = str(body.details, 4000) || null;
  const { email, phone } = splitContact(str(body.contact, 254));
  if (!slug || !name || !need) {
    return NextResponse.json({ error: "Please fill in your name and what you need." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Please enter a valid email address or phone number." }, { status: 400 });
  }
  const mode: "contact" | "quote" = body.mode === "quote" ? "quote" : "contact";
  const budget = mode === "quote" && (BUDGET_OPTIONS as readonly string[]).includes(body.budget || "") ? body.budget! : null;
  const timing = mode === "quote" && (TIMING_OPTIONS as readonly string[]).includes(body.timing || "") ? body.timing! : null;

  let row;
  try { row = await getGateRow(slug); } catch (e) {
    console.error("[leads-plus/lead]", (e as Error).message);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  const gate = leadFormGate(row);
  if (!gate.ok) return NextResponse.json({ error: "This business is not accepting online inquiries." }, { status: 403 });

  // Service must be one of the owner's own services (else dropped).
  const svc = str(body.service, 120);
  const service = svc && (row.services ?? []).includes(svc) ? svc : null;

  // Spam layer 2: per-IP rate limit, counted from the ledger itself (no paid service).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ipHash = hashIp(ip);
  if (ipHash) {
    const shortSince = new Date(Date.now() - RATE_LIMIT.shortWindowMin * 60_000).toISOString();
    const daySince = new Date(Date.now() - 86400_000).toISOString();
    const [{ count: shortN }, { count: dayN }] = await Promise.all([
      supabaseAdmin.from(LEADS_TABLE).select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", shortSince),
      supabaseAdmin.from(LEADS_TABLE).select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", daySince),
    ]);
    if ((shortN ?? 0) >= RATE_LIMIT.shortMax || (dayN ?? 0) >= RATE_LIMIT.dayMax) {
      return NextResponse.json({ error: "Too many requests — please try again later, or call the business." }, { status: 429 });
    }
  }

  const test = isTestContext(slug);
  const { data: lead, error: insErr } = await supabaseAdmin
    .from(LEADS_TABLE)
    .insert({
      listing_id: row.id, customer_name: name, customer_email: email, customer_phone: phone,
      need, details, service, budget, timing, mode, is_test: test, ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (insErr || !lead) {
    // Fail closed: no ledger row ⇒ no email, honest retryable error (the TDL #1047 lesson).
    console.error(`[leads-plus/lead] LEDGER WRITE FAILED ${slug}: ${insErr?.message ?? "no row"}`);
    return NextResponse.json({ error: "We couldn't send your message just now. Please try again — nothing was sent." }, { status: 500 });
  }

  const recipients = [row.owner_email!, (row as { lead_notify_email2?: string | null }).lead_notify_email2]
    .filter((a): a is string => !!a && isValidEmail(a))
    .filter((a, i, all) => all.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === i);
  const deliverable: string[] = [];
  for (const a of recipients) if (!(await isAddressUndeliverable(a))) deliverable.push(a);

  let notify: "sent" | "failed" | "bounced" = "failed";
  let messageId: string | null = null;
  if (deliverable.length === 0) {
    notify = "bounced"; // every owner address is on the suppression list → dashboard flag
  } else {
    const r = await sendLeadNotification(deliverable, {
      businessName: row.name, slug, test, name, email, phone, need, details, service, budget, timing, mode,
      subject: leadSubject({ service, need, name, test }),
    });
    notify = r.ok ? "sent" : "failed";
    messageId = r.id ?? null;
    if (!r.ok) console.error(`[leads-plus/lead] notify failed ${slug}: ${r.error}`);
  }
  await supabaseAdmin.from(LEADS_TABLE).update({ notify_status: notify, notify_message_id: messageId }).eq("id", lead.id);

  // The lead is stored either way; the owner sees it in their inbox even if the email failed.
  return NextResponse.json({ success: true });
}
