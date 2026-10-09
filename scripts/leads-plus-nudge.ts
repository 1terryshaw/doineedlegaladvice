// leads-plus-canary-v1 P6 — Leads Plus monthly nudge. RENDER ONLY: real sends are NOT scheduled (ruling).
// Leads Plus owners self-edit any time, so there is NO change-batch queue for them — just this nudge with up to 3 AI
// suggestions. Every suggestion passes forbiddenClaims() against the listing's own facts or it is dropped (P2 rule).
// Sender = the owner-only transactional domain (notifications@doineedanetwork.com) — never the cold outreach pool.
//
//   npx tsx scripts/leads-plus-nudge.ts                     dry run over every lead_monthly_kit_enabled listing
//   npx tsx scripts/leads-plus-nudge.ts --test-send <slug>  ONE [TEST] nudge to terry@marketingteaminabox.com (fixture only)
// Skip rule: no nudge if the owner already published (or edited) their kit in the current Stripe billing period.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { factsInput, forbiddenClaims, type KitFacts } from "../lib/content-kit";
import { hasLeadsPlus, TEST_FIXTURE_SLUG_PREFIX } from "../lib/leads-plus";
import verticalConfig from "../lib/vertical.config";

for (const line of readFileSync(process.env.MASTER_ENV || "/home/terry/empire/secrets/master.env", "utf8").split("\n")) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const TERRY = "terry@marketingteaminabox.com";
const VC = verticalConfig as unknown as { name: string; domain: string; tablePrefix: string };
const FROM = `${VC.name} <notifications@doineedanetwork.com>`;
const SITE = `https://${VC.domain}`;
const TABLE = `${VC.tablePrefix}listings`;
const MODEL = process.env.LEADS_KIT_MODEL || "claude-haiku-5-5";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Row = {
  id: string; slug: string; name: string; city: string | null; province_state: string | null; description: string | null;
  services: string[] | null; service_area: string[] | null; year_established: number | null; payment_methods: string | null;
  hours_json: unknown; tier: string | null; subscription_tier: string | null; owner_email: string | null; claimed: boolean | null;
  leads_plus_enabled: boolean | null; stripe_subscription_id: string | null; tier_activated_at: string | null; claimed_at: string | null;
  lead_kit_published_at: string | null; lead_kit_draft: { updated_at?: string } | null;
};
const COLS = "id, slug, name, city, province_state, description, services, service_area, year_established, payment_methods, hours_json, tier, subscription_tier, owner_email, claimed, leads_plus_enabled, stripe_subscription_id, tier_activated_at, claimed_at, lead_kit_published_at, lead_kit_draft";

const addMonths = (d: Date, n: number) => { const x = new Date(d); const day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + n); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(day, last)); return x; };
export async function period(r: Row, now = new Date()): Promise<{ start: Date; end: Date; source: "stripe" | "anniversary" }> {
  if (r.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const sub: any = await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.retrieve(r.stripe_subscription_id);
      const it = sub.items?.data?.[0];
      const a = it?.current_period_start ?? sub.current_period_start, b = it?.current_period_end ?? sub.current_period_end;
      if (a && b) return { start: new Date(a * 1000), end: new Date(b * 1000), source: "stripe" };
    } catch { /* fall back */ }
  }
  const anchor = new Date(r.tier_activated_at || r.claimed_at || now.toISOString());
  let k = 0; while (addMonths(anchor, k + 1) <= now) k++;
  return { start: addMonths(anchor, k), end: addMonths(anchor, k + 1), source: "anniversary" };
}

async function suggestions(r: Row): Promise<{ kept: string[]; dropped: { text: string; why: string[] }[] }> {
  const f: KitFacts = { name: r.name, city: r.city, province_state: r.province_state, description: r.description, services: r.services, service_area: r.service_area, year_established: r.year_established, payment_methods: r.payment_methods };
  const { text } = factsInput(f);
  const base: string[] = [];
  if (!r.hours_json) base.push("Add your opening hours so customers know when to call.");
  if (!r.lead_kit_published_at) base.push("Approve your page content in the content kit — nothing new shows until you do.");
  let ai: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic();
      const res: any = await anthropic.messages.create({
        model: MODEL, max_tokens: 300,
        ...(MODEL.startsWith("claude-haiku-5") ? { thinking: { type: "disabled" }, output_config: { effort: "low" } } : {}),
        system: "Suggest up to 3 short, concrete improvements a small business owner could make to their directory listing page this month. Use ONLY the facts given — never add a number, year, price, licence, award, superlative or place name not in them. One suggestion per line, no numbering.",
        messages: [{ role: "user", content: `FACTS:\n${text}` }],
      } as any);
      ai = ((res.content || []).find((b: any) => b.type === "text")?.text || "").split("\n").map((s: string) => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
    } catch (e) { console.error("[nudge] model call failed:", (e as Error).message); }
  }
  const kept: string[] = [], dropped: { text: string; why: string[] }[] = [];
  for (const s of [...base, ...ai]) {
    const v = forbiddenClaims(s, `${text}\n${base.join("\n")}`);
    if (v.length) dropped.push({ text: s, why: v }); else if (kept.length < 3) kept.push(s);
  }
  return { kept, dropped };
}

export function render(r: Row, sugg: string[]) {
  return {
    subject: "Your monthly update is ready — tell us everything you'd like changed",
    text: [
      `Hi,`, ``, `Your monthly update for ${r.name} is ready. You can change your page any time — here are up to 3 ideas for this month:`, ``,
      ...sugg.map((s) => `• ${s}`), ``, `Open your content kit: ${SITE}/owner/${r.slug}?kit=1`, ``,
      `Nothing goes live until you approve it.`, ``, `— ${VC.name}`,
    ].join("\n"),
  };
}

async function rows(slug?: string): Promise<Row[]> {
  let qb = db.from(TABLE).select(COLS).eq("lead_monthly_kit_enabled", true);
  if (slug) qb = db.from(TABLE).select(COLS).eq("slug", slug);
  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

async function main() {
  const a = process.argv.slice(2), i = a.indexOf("--test-send");
  const slug = i >= 0 ? a[i + 1] : undefined;
  if (slug && !slug.startsWith(TEST_FIXTURE_SLUG_PREFIX)) throw new Error("--test-send is for the reserved test fixture only");
  for (const r of await rows(slug)) {
    if (!hasLeadsPlus(r) || r.leads_plus_enabled !== true || r.claimed !== true) { console.log(`skip  ${r.slug}  not an active Leads Plus listing`); continue; }
    const p = await period(r);
    const edited = [r.lead_kit_published_at, r.lead_kit_draft?.updated_at].filter(Boolean).map((x) => new Date(x!)).some((d) => d >= p.start && d < p.end);
    const span = `${p.start.toISOString().slice(0, 10)}..${p.end.toISOString().slice(0, 10)} (${p.source})`;
    if (edited && !slug) { console.log(`skip  ${r.slug}  already edited this period ${span}`); continue; }
    const s = await suggestions(r);
    const m = render(r, s.kept);
    console.log(`${slug ? "TEST " : "NUDGE"} ${r.slug}  period ${span}${edited ? " (edited this period — a real run would SKIP)" : ""}`);
    console.log(`  suggestions kept ${s.kept.length}, dropped ${s.dropped.length}${s.dropped.length ? `: ${JSON.stringify(s.dropped)}` : ""}`);
    console.log(m.text.split("\n").map((l) => "    " + l).join("\n"));
    if (slug) {
      const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: FROM, to: [TERRY], subject: `[TEST] ${m.subject}`, text: `[TEST — not a real customer]\n${m.text}` });
      console.log(`  [TEST] send → ${TERRY}: ${error ? `FAILED ${error.message}` : `sent ${data?.id}`}`);
    }
  }
}
main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
