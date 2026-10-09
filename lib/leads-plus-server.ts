// leads-plus-canary-v1 — server-only reads/sends for Leads Plus. Never import from a client component.
import { unstable_cache, revalidateTag } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import { leadFormGate, hasLeadsPlus, websiteLinkable, whatsappDigits, LEADS_TABLE, type GateResult } from "@/lib/leads-plus";
import { isValidEmail } from "@/lib/inquiry-guard";
import type { PublishedKit } from "@/lib/content-kit";

// Columns the public render needs. owner_email is read ONLY to compute the gate and is never
// returned from this module (the result is CDN/ISR-cached).
const GATE_COLS =
  "id, slug, name, tier, subscription_tier, claimed, owner_email, email, phone, website, website_verdict, services, " +
  "leads_plus_enabled, lead_whatsapp, lead_page_mode, lead_kit_published";

export type LeadsPlusPublic = {
  gate: GateResult;
  entitled: boolean;
  mode: "A" | "B";
  whatsapp: string | null;
  publicEmail: string | null; // the BUSINESS's public email, only if the owner turned the Email button on
  websiteOk: boolean;
  services: string[];
  kit: PublishedKit | null;
};

type GateRow = {
  id: string; slug: string; name: string; tier: string | null; subscription_tier: string | null;
  claimed: boolean | null; owner_email: string | null; email: string | null; phone: string | null;
  website: string | null; website_verdict: string | null; services: string[] | null;
  leads_plus_enabled: boolean | null; lead_whatsapp: string | null; lead_page_mode: string | null;
  lead_kit_published: PublishedKit | null;
};

export function shapePublic(row: GateRow | null): LeadsPlusPublic | null {
  if (!row) return null;
  const gate = leadFormGate(row);
  const kit = (row.lead_kit_published as PublishedKit | null) ?? null;
  const buttons = kit?.contact_buttons ?? ["call", "website", "whatsapp"];
  return {
    gate,
    entitled: hasLeadsPlus(row),
    mode: row.lead_page_mode === "B" ? "B" : "A",
    whatsapp: buttons.includes("whatsapp") ? whatsappDigits(row.lead_whatsapp) : null,
    publicEmail: buttons.includes("email") && isValidEmail(row.email) ? row.email : null,
    websiteOk: buttons.includes("website") && websiteLinkable(row.website, row.website_verdict),
    services: Array.isArray(row.services) ? row.services.filter((s) => typeof s === "string" && s.trim()) : [],
    // R8: only owner-APPROVED content ever renders — and only while the gate is open.
    kit: gate.ok ? kit : null,
  };
}

/** Cached (ISR) Leads Plus state for the public detail page. Tag `listing:{slug}` — the same tag the
 *  page's main read uses, so one revalidate covers both. Fail-open: any error ⇒ null ⇒ no form. */
// fixup-1 (prod-verified 2026-10-09): the shared `supabaseRead` client caches its FETCH for 24 h with NO
// tag, so purging `listing:<slug>` re-ran this function against a stale fetch and a flag flip stayed
// invisible for up to a day. This read's fetch carries the same tag, so one purge refreshes both layers.
function taggedReader(slug: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, next: { revalidate: 86400, tags: [`listing:${slug}`] } } as RequestInit),
    },
  });
}

export function getLeadsPlusPublicCached(slug: string): Promise<LeadsPlusPublic | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await taggedReader(slug)
        .from(LISTINGS_TABLE)
        .select(GATE_COLS)
        .neq("is_published", false)
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        console.error(`[leads-plus] public read failed (${slug}): ${error.message}`);
        return null;
      }
      return shapePublic(data as unknown as GateRow | null);
    },
    ["leads-plus-public-v2", slug],
    { revalidate: 86400, tags: [`listing:${slug}`] }
  )();
}

/** Uncached gate read for write paths (lead submit, taps, checkout). */
export async function getGateRow(slug: string): Promise<GateRow | null> {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select(GATE_COLS + ", lead_notify_email2, is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`gate read failed: ${error.message}`);
  const row = data as unknown as (GateRow & { is_published: boolean | null }) | null;
  if (!row || row.is_published === false) return null;
  return row;
}

export function revalidateListing(slug: string) {
  try { revalidateTag(`listing:${slug}`); } catch (e) { console.error("[leads-plus] revalidate failed:", (e as Error).message); }
}

// ── Owner notification ────────────────────────────────────────────────────────────────────────
// Owner mail rides the owner-only transactional domain (doineedanetwork.com — verified in Resend).
// NEVER the cold outreach pool. Reply-To = the customer, so "Reply" in the owner's mail app answers them.
const OWNER_FROM = `${verticalConfig.name} <notifications@doineedanetwork.com>`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export type LeadForEmail = {
  businessName: string; slug: string; subject: string; test: boolean;
  name: string; email: string | null; phone: string | null; need: string; details: string | null;
  service: string | null; budget: string | null; timing: string | null; mode: "contact" | "quote";
};

// Owner lead notifications are TRANSACTIONAL mail the owner paid for. Only DELIVERY-FAILURE reasons on
// the shared suppression list stop them (and raise the dashboard bounce flag). Outreach reasons
// (unsubscribe, frequency cap, internal_self, …) govern cold mail and must NEVER drop a paying owner's lead.
const UNDELIVERABLE_REASONS = ["resend_hard_bounce", "hard_bounce", "resend_complaint", "rcpt_invalid", "mx_fail"];

export async function isAddressUndeliverable(addr: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("email_suppressions")
    .select("id")
    .eq("email_normalized", addr.trim().toLowerCase())
    .in("reason", UNDELIVERABLE_REASONS)
    .limit(1);
  if (error) { console.error("[leads-plus] suppression read failed:", error.message); return false; }
  return (data?.length ?? 0) > 0;
}

export async function sendLeadNotification(to: string[], lead: LeadForEmail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const rows: [string, string | null][] = [
    ["Name", lead.name], ["Email", lead.email], ["Phone", lead.phone],
    ["Service", lead.service], ["What they need", lead.need], ["Details", lead.details],
    ...(lead.mode === "quote" ? ([["Budget", lead.budget], ["Timing", lead.timing]] as [string, string | null][]) : []),
  ];
  const text = [
    lead.test ? "THIS IS A TEST LEAD — no real customer sent it.\n" : "",
    `New inquiry for ${lead.businessName} from your listing on ${verticalConfig.displayDomain}.`,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    lead.email ? "Reply to this email to answer the customer directly." : "The customer left a phone number — call or text them back.",
    "",
    `Your leads inbox: https://${verticalConfig.displayDomain}/owner/${lead.slug}`,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px">
${lead.test ? '<p style="background:#fef3c7;padding:8px 12px;border-radius:6px"><strong>TEST LEAD</strong> — no real customer sent it.</p>' : ""}
<p>New inquiry for <strong>${esc(lead.businessName)}</strong> from your listing on ${esc(verticalConfig.displayDomain)}.</p>
<table style="border-collapse:collapse;font-size:14px">${rows.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;white-space:pre-line">${esc(v!)}</td></tr>`).join("")}</table>
<p style="margin-top:16px">${lead.email ? "Reply to this email to answer the customer directly." : "The customer left a phone number — call or text them back."}</p>
<p style="font-size:12px;color:#6b7280">Your leads inbox: <a href="https://${esc(verticalConfig.displayDomain)}/owner/${esc(lead.slug)}">${esc(verticalConfig.displayDomain)}/owner</a></p>
</div>`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: OWNER_FROM,
      to,
      ...(lead.email ? { replyTo: lead.email } : {}),
      subject: lead.subject,
      text,
      html,
      headers: { "X-Entity-Ref-ID": `leadsplus-${lead.slug}-${Date.now()}` },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Bounce / complaint → dashboard flag. Two signals: the shared suppression list (written by the
 *  empire-wide Resend webhook) and, for recent leads, Resend's own last_event for that message. */
export async function refreshNotifyStatuses(listingId: string): Promise<void> {
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data } = await supabaseAdmin
    .from(LEADS_TABLE)
    .select("id, notify_message_id")
    .eq("listing_id", listingId)
    .eq("notify_status", "sent")
    .not("notify_message_id", "is", null)
    .gte("created_at", since)
    .limit(10);
  for (const r of data ?? []) {
    try {
      const res = await fetch(`https://api.resend.com/emails/${r.notify_message_id}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { last_event?: string };
      const ev = (j.last_event || "").toLowerCase();
      if (ev === "bounced" || ev === "complained") {
        await supabaseAdmin.from(LEADS_TABLE).update({ notify_status: ev }).eq("id", r.id);
      }
    } catch { /* best-effort */ }
  }
}
