// leads-plus-canary-v1 — OWNER CONTENT KIT v1 API (owner-authenticated, Leads Plus only).
//   GET  ?slug=                         → draft (built from the listing on first open) + publish preview
//   POST {slug, action:"suggest"}       → AI rewrites (description, why choose us) + fact-only FAQs.
//                                         Every AI output passes the forbidden-claims check or is DROPPED.
//   POST {slug, action:"apply", op...}  → Accept / Edit / Delete / Replace / Accept all from your listing
//   POST {slug, action:"publish"}       → THE publish gate: writes lead_kit_published (owner approval)
// Model per K311: rewrite of short owner facts = extraction/rewrite class → the cheapest hosted model
// (Haiku 5.5), thinking off, low effort; the deterministic claims check is the real safety layer.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyOwnerAccess } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { hasLeadsPlus, whatsappDigits } from "@/lib/leads-plus";
import { revalidateListing } from "@/lib/leads-plus-server";
import verticalConfig from "@/lib/vertical.config";
import { listPhotosForListing } from "@/lib/listing-photos";
import { normalizeHours, formatHoursLine, DAY_KEYS, DAY_LABELS } from "@/lib/listing-extras";
import { isValidEmail } from "@/lib/inquiry-guard";
import {
  buildInitialDraft, applyAction, publishKit, publishPreview, suggestFaqs, vetSuggestion, factsInput,
  isKitDraft, type KitDraft, type KitFacts, type KitAction, type KitProfile, type SectionKey, SECTION_ORDER,
} from "@/lib/content-kit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KIT_MODEL = process.env.LEADS_KIT_MODEL || "claude-haiku-5-5";
// Kit profile from the directory's config (lodging directories set kitProfile: "lodging"); default "trade".
const KIT_PROFILE: KitProfile = (verticalConfig as { kitProfile?: KitProfile }).kitProfile ?? "trade";

async function owner(slug?: string | null) {
  if (!slug) return null;
  const a = await verifyOwnerAccess(slug);
  const l = a?.listing;
  if (!l || !hasLeadsPlus(l) || l.leads_plus_enabled !== true) return null;
  return l;
}

async function factsFor(l: Record<string, any>): Promise<KitFacts> {
  const hours = normalizeHours(l.hours_json);
  const hoursText = hours
    ? DAY_KEYS.filter((d) => hours[d]).map((d) => `${DAY_LABELS[d]}: ${formatHoursLine(hours[d]!)}`).join("\n") || null
    : null;
  const { photos } = await listPhotosForListing(l.id);
  return {
    name: l.name, city: l.city, province_state: l.province_state, description: l.description,
    services: l.services, service_area: l.service_area, hours_text: hoursText,
    year_established: l.year_established, payment_methods: l.payment_methods,
    owner_photo_urls: photos.map((p: { public_url: string }) => p.public_url),
    has_phone: !!l.phone, has_public_email: isValidEmail(l.email), has_website: !!l.website,
    has_whatsapp: !!whatsappDigits(l.lead_whatsapp),
  };
}

async function loadDraft(l: Record<string, any>): Promise<KitDraft> {
  return isKitDraft(l.lead_kit_draft) ? l.lead_kit_draft : buildInitialDraft(await factsFor(l), new Date(), KIT_PROFILE);
}

async function saveDraft(id: string, d: KitDraft) {
  const { error } = await supabaseAdmin.from(LISTINGS_TABLE).update({ lead_kit_draft: d }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest) {
  const l = await owner(req.nextUrl.searchParams.get("slug"));
  if (!l) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const draft = await loadDraft(l);
  return NextResponse.json({ draft, preview: publishPreview(draft), mode: l.lead_page_mode ?? null, published_at: l.lead_kit_published_at ?? null });
}

async function aiRewrite(f: KitFacts): Promise<{ description?: string; why_choose_us?: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) return {};
  const { text } = factsInput(f);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const haiku5 = KIT_MODEL.startsWith("claude-haiku-5") ? { thinking: { type: "disabled" }, output_config: { effort: "low" } } : {};
  const res = await anthropic.messages.create({
    model: KIT_MODEL,
    max_tokens: 600,
    ...(haiku5 as Record<string, unknown>),
    system:
      "You rewrite a small business's own listing facts into clear, friendly website copy. " +
      "HARD RULES: use ONLY the facts given. Do not add any number, year, price, licence, certification, insurance, award, " +
      "guarantee, ranking, superlative (best/#1/top), place name or person name that is not in the facts. " +
      "Do not invent experience, team size or reviews. If the facts are thin, write less. " +
      'Reply with JSON only: {"description": "2-3 sentences", "why_choose_us": ["short reason", "..."]} — why_choose_us max 3 items, each built only from the facts.',
    messages: [{ role: "user", content: `FACTS:\n${text}` }],
  } as Parameters<typeof anthropic.messages.create>[0]);
  const block = (res as { content: { type: string; text?: string }[] }).content.find((b) => b.type === "text");
  const raw = block?.text?.trim() ?? "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json) as { description?: unknown; why_choose_us?: unknown };
    return {
      description: typeof parsed.description === "string" ? parsed.description.trim() : undefined,
      why_choose_us: Array.isArray(parsed.why_choose_us) ? parsed.why_choose_us.filter((x): x is string => typeof x === "string").slice(0, 3) : undefined,
    };
  } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ({ slug?: string; action?: string } & Partial<KitAction>) | null;
  const l = await owner(body?.slug);
  if (!l) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  let draft = await loadDraft(l);

  if (body?.action === "suggest") {
    const f = await factsFor(l);
    const dropped: { key: string; violations: string[] }[] = [];
    let ai: Awaited<ReturnType<typeof aiRewrite>> = {};
    try { ai = await aiRewrite(f); } catch (e) { console.error("[kit] model call failed:", (e as Error).message); }
    const replace = (key: SectionKey, sec: KitDraft["sections"][number]) => {
      // Never overwrite something the owner already accepted or typed.
      draft = { ...draft, sections: draft.sections.map((s) => (s.key === key && s.status === "pending" && !s.edited ? sec : s)) };
    };
    for (const key of ["description", "why_choose_us"] as const) {
      const out = ai[key];
      if (!out || (Array.isArray(out) && !out.length)) continue;
      const v = vetSuggestion(key, out, f);
      if (v.ok) replace(key, v.section);
      else dropped.push({ key, violations: v.violations });
    }
    const faqs = suggestFaqs(f);
    if (faqs) replace("faqs", { key: "faqs", label: "suggested", value: faqs.value, status: "pending", provenance: faqs.provenance });
    draft = { ...draft, updated_at: new Date().toISOString() };
    await saveDraft(l.id, draft);
    if (dropped.length) console.log(`[kit] dropped suggestions for ${l.slug}: ${JSON.stringify(dropped)}`);
    return NextResponse.json({ draft, preview: publishPreview(draft), dropped, model: KIT_MODEL });
  }

  if (body?.action === "apply") {
    const op = body.op as KitAction["op"] | undefined;
    const key = (body as { key?: SectionKey }).key;
    if (!op || !["accept", "delete", "edit", "replace", "accept_all_listing"].includes(op)) {
      return NextResponse.json({ error: "Invalid op" }, { status: 400 });
    }
    if (op !== "accept_all_listing" && (!key || !SECTION_ORDER.includes(key))) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }
    draft = applyAction(draft, body as unknown as KitAction);
    await saveDraft(l.id, draft);
    return NextResponse.json({ draft, preview: publishPreview(draft) });
  }

  if (body?.action === "publish") {
    const published = publishKit(draft);
    const { error } = await supabaseAdmin.from(LISTINGS_TABLE)
      .update({ lead_kit_draft: draft, lead_kit_published: published, lead_kit_published_at: published.published_at })
      .eq("id", l.id);
    if (error) return NextResponse.json({ error: "Publish failed" }, { status: 500 });
    revalidateListing(l.slug);
    return NextResponse.json({ ok: true, published, preview: publishPreview(draft) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
