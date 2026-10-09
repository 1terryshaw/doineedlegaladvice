// leads-plus-canary-v1 — owner Leads Plus API. Owners read their leads ONLY through this server
// route (the leads table is service-role only, RLS on). Every method is owner-authenticated
// (verifyOwnerAccess = signed owner cookie bound to this slug, claimed row, unexpired token).
//
//   GET    ?slug=        → inbox (date, name, need, status), tap counts, bounce flag, settings
//   PATCH  {slug, leadId, status}            → New / Replied / Closed
//   PATCH  {slug, settings:{notify2, whatsapp, mode}}
//   POST   {slug, action:"test_lead"}        → "Send me a test lead" ([TEST] subject, capped per day)
import { NextRequest, NextResponse } from "next/server";
import { verifyOwnerAccess } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { isValidEmail } from "@/lib/inquiry-guard";
import {
  hasLeadsPlus, leadFormGate, leadSubject, whatsappDigits,
  LEADS_TABLE, TAPS_TABLE, TEST_LEADS_PER_DAY,
} from "@/lib/leads-plus";
import { sendLeadNotification, isAddressUndeliverable, refreshNotifyStatuses, revalidateListing } from "@/lib/leads-plus-server";

export const dynamic = "force-dynamic";

async function owner(slug: string | null | undefined) {
  if (!slug) return null;
  const access = await verifyOwnerAccess(slug);
  return access?.listing ?? null;
}

export async function GET(req: NextRequest) {
  const listing = await owner(req.nextUrl.searchParams.get("slug"));
  if (!listing) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (listing.leads_plus_enabled !== true) {
    return NextResponse.json({ entitled: hasLeadsPlus(listing), enabled: false, leads: [], taps: {} });
  }
  if (!hasLeadsPlus(listing)) {
    // Downgraded / cancelled: the owner keeps READ-ONLY sight of their inquiry history (R6: kept 12 months).
    // PATCH/POST stay 403, so nothing can be changed or sent.
    const { data: history } = await supabaseAdmin.from(LEADS_TABLE)
      .select("id, created_at, customer_name, need, status, is_test")
      .eq("listing_id", listing.id).order("created_at", { ascending: false }).limit(100);
    return NextResponse.json({ entitled: false, enabled: true, readOnly: true, leads: history ?? [], taps: {} });
  }
  await refreshNotifyStatuses(listing.id);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [leadsRes, tapsRes] = await Promise.all([
    supabaseAdmin.from(LEADS_TABLE)
      .select("id, created_at, customer_name, customer_email, customer_phone, need, details, service, budget, timing, mode, status, is_test, notify_status")
      .eq("listing_id", listing.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from(TAPS_TABLE).select("kind, n").eq("listing_id", listing.id).gte("day", since),
  ]);
  const taps: Record<string, number> = { call: 0, email: 0, website: 0, whatsapp: 0 };
  for (const t of tapsRes.data ?? []) taps[t.kind] = (taps[t.kind] ?? 0) + t.n;

  const addrs = [listing.owner_email, listing.lead_notify_email2].filter((a): a is string => !!a && isValidEmail(a));
  const suppressed: string[] = [];
  for (const a of addrs) if (await isAddressUndeliverable(a)) suppressed.push(a);
  const leads = leadsRes.data ?? [];
  const bounced = suppressed.length > 0 || leads.some((l) => l.notify_status === "bounced" || l.notify_status === "complained");

  return NextResponse.json({
    entitled: true,
    enabled: true,
    gate: leadFormGate(listing),
    leads,
    taps,
    tapsWindowDays: 30,
    deliveryProblem: bounced ? { suppressed, message: "Lead emails to your address are bouncing or were marked as spam. Check the address, or add a second notification address." } : null,
    settings: { notify2: listing.lead_notify_email2 ?? "", whatsapp: listing.lead_whatsapp ?? "", mode: listing.lead_page_mode ?? null },
  });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    slug?: string; leadId?: string; status?: string;
    settings?: { notify2?: string; whatsapp?: string; mode?: string };
  } | null;
  const listing = await owner(body?.slug);
  if (!listing) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!hasLeadsPlus(listing) || listing.leads_plus_enabled !== true) {
    return NextResponse.json({ error: "Leads Plus is not active on this listing" }, { status: 403 });
  }

  if (body?.leadId) {
    if (!["new", "replied", "closed"].includes(body.status || "")) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from(LEADS_TABLE).update({ status: body.status })
      .eq("id", body.leadId).eq("listing_id", listing.id).select("id");
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body?.settings) {
    const s = body.settings;
    const patch: Record<string, unknown> = {};
    if (s.notify2 !== undefined) {
      const v = s.notify2.trim();
      if (v && !isValidEmail(v)) return NextResponse.json({ error: "Second notification address is not a valid email." }, { status: 400 });
      patch.lead_notify_email2 = v || null;
    }
    if (s.whatsapp !== undefined) {
      const v = s.whatsapp.trim();
      if (v && !whatsappDigits(v)) return NextResponse.json({ error: "WhatsApp number should include the country code, e.g. +1 555 010 0199." }, { status: 400 });
      patch.lead_whatsapp = v ? v.slice(0, 40) : null;
    }
    if (s.mode !== undefined) {
      if (!["A", "B"].includes(s.mode)) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
      patch.lead_page_mode = s.mode;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    const { error } = await supabaseAdmin.from(LISTINGS_TABLE).update(patch).eq("id", listing.id);
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    revalidateListing(listing.slug);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { slug?: string; action?: string } | null;
  const listing = await owner(body?.slug);
  if (!listing) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (body?.action !== "test_lead") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!hasLeadsPlus(listing) || listing.leads_plus_enabled !== true) {
    return NextResponse.json({ error: "Leads Plus is not active on this listing" }, { status: 403 });
  }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from(LEADS_TABLE).select("id", { count: "exact", head: true })
    .eq("listing_id", listing.id).eq("is_test", true).gte("created_at", today.toISOString());
  if ((count ?? 0) >= TEST_LEADS_PER_DAY) {
    return NextResponse.json({ error: `You can send ${TEST_LEADS_PER_DAY} test leads a day. Try again tomorrow.` }, { status: 429 });
  }
  const service = (listing.services ?? [])[0] ?? null;
  const lead = {
    customer_name: "Test Customer", customer_email: null as string | null, customer_phone: "(555) 010-0100",
    need: "This is a test inquiry so you can see what a real one looks like", details: "Nothing to do — you can close this one.",
    service, mode: "contact" as const,
  };
  const { data: row, error } = await supabaseAdmin.from(LEADS_TABLE).insert({ listing_id: listing.id, ...lead, is_test: true }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not create the test lead" }, { status: 500 });
  const to = [listing.owner_email, listing.lead_notify_email2].filter((a): a is string => !!a && isValidEmail(a));
  const deliverable: string[] = [];
  for (const a of to) if (!(await isAddressUndeliverable(a))) deliverable.push(a);
  let notify: "sent" | "failed" | "bounced" = "bounced";
  let id: string | null = null;
  if (deliverable.length) {
    const r = await sendLeadNotification(deliverable, {
      businessName: listing.name, slug: listing.slug, test: true,
      name: lead.customer_name, email: null, phone: lead.customer_phone, need: lead.need, details: lead.details,
      service, budget: null, timing: null, mode: "contact",
      subject: leadSubject({ service, need: lead.need, name: lead.customer_name, test: true }),
    });
    notify = r.ok ? "sent" : "failed";
    id = r.id ?? null;
  }
  await supabaseAdmin.from(LEADS_TABLE).update({ notify_status: notify, notify_message_id: id }).eq("id", row.id);
  return NextResponse.json({ ok: true, notify, sentTo: deliverable.length });
}
