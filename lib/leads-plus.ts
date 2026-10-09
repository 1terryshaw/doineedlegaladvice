// leads-plus-canary-v1 (2026-10-09) — Leads Plus: the $19 USD/mo tier that upgrades the owner's
// EXISTING listing URL into a lead-capturing page (Reviews Plus included).
//
// ONE entitlement helper (hasLeadsPlus) and ONE render gate (leadFormGate). Every place that
// asks "does this listing get Leads Plus?" goes through these — never through a raw tier string.
//
// Rulings encoded here (CEO 2026-10-09):
//   R1/R2  $49/$99/$199 include Leads Plus      → capability on reviews_plus + website + growth
//   migration: active Reviews Plus subs grant it → reviews_plus carries the capability
//   R4  no lead forms on health / mental-health / register verticals at launch
//   R9  Free tier: no lead form                  → entitlement false on free/seed
//   R10 Unclaimed rows NEVER get a lead form     → claimed === true required
//   CANARY: leads_plus_enabled (per listing, default false) — real owners stay OFF until Terry says go.
import { createHash } from "crypto";
import { can, getEffectiveTier } from "@/lib/tier-capabilities";
import { isValidEmail } from "@/lib/inquiry-guard";
import verticalConfig from "@/lib/vertical.config";

export type LeadsPlusListing = {
  tier?: string | null;
  subscription_tier?: string | null;
  claimed?: boolean | null;
  owner_email?: string | null;
  leads_plus_enabled?: boolean | null;
};

// R4 — verticals that must never render a lead form at launch. Matched on the table prefix, so a
// stamped clone of this repo inherits the block without a config edit.
const R4_BLOCKED_PREFIX =
  /^(dentist|dent|doctor|medical|med|clinic|health|homehealth|hh|therapist|ther|counsel|psych|mentalhealth|nurse|nursing|carehome|care|dialysis|hospice|optometrist|opto|chiro|physio|pharm|vet|daycare|childcare|register|cqc|ofsted|gp)_/;

export function verticalAllowsLeadForms(): boolean {
  const cfg = verticalConfig as { tablePrefix: string; leadsPlusAllowed?: boolean };
  if (cfg.leadsPlusAllowed === false) return false;
  return !R4_BLOCKED_PREFIX.test(cfg.tablePrefix);
}

/** THE Leads Plus entitlement. True for Leads Plus, Reviews Plus, Website and above. */
export function hasLeadsPlus(listing: Pick<LeadsPlusListing, "tier" | "subscription_tier"> | null | undefined): boolean {
  if (!listing) return false;
  return can(getEffectiveTier(listing), "leads_plus");
}

/** Owner email confirmed = the row was claimed through the emailed verify link (the only path that
 *  sets claimed=true) AND the address on file is a real, deliverable-shaped address. */
export function ownerEmailConfirmed(listing: Pick<LeadsPlusListing, "claimed" | "owner_email"> | null | undefined): boolean {
  return !!listing && listing.claimed === true && isValidEmail(listing.owner_email ?? null);
}

export type GateResult = { ok: true } | { ok: false; reason: "vertical_r4" | "unclaimed" | "email_unconfirmed" | "not_entitled" | "canary_off" };

/** THE lead-form render gate: claimed AND owner email confirmed AND leads_plus AND leads_plus_enabled. */
export function leadFormGate(listing: LeadsPlusListing | null | undefined): GateResult {
  if (!verticalAllowsLeadForms()) return { ok: false, reason: "vertical_r4" };
  if (!listing || listing.claimed !== true) return { ok: false, reason: "unclaimed" };
  if (!ownerEmailConfirmed(listing)) return { ok: false, reason: "email_unconfirmed" };
  if (!hasLeadsPlus(listing)) return { ok: false, reason: "not_entitled" };
  if (listing.leads_plus_enabled !== true) return { ok: false, reason: "canary_off" };
  return { ok: true };
}

// Fixture convention (mirrors empire-billing's reserved prefix): no real listing slug starts with it.
export const TEST_FIXTURE_SLUG_PREFIX = "test-leadsplus-";

/** A lead is a TEST lead off-production or on the reserved fixture. Every test email subject starts
 *  with "[TEST]". The owner's address is never used to decide this. */
export function isTestContext(slug: string): boolean {
  return process.env.VERCEL_ENV !== "production" || slug.startsWith(TEST_FIXTURE_SLUG_PREFIX);
}

// Dead / parked websites are never linked (existing website_checked_at / website_verdict data).
const DEAD_VERDICTS = new Set(["DEAD_DNS", "DEAD_HTTP_GONE", "DEAD_CONN", "DEAD_HTTP_5XX", "STRUCTURAL_DEAD", "PARKED"]);
export function websiteLinkable(website: string | null | undefined, verdict: string | null | undefined): boolean {
  if (!website || !/^https?:\/\//i.test(website.trim())) return false;
  return !(verdict && DEAD_VERDICTS.has(verdict.toUpperCase()));
}

// ── Form vocabulary ────────────────────────────────────────────────────────────────────────────
export const BUDGET_OPTIONS = ["Under $250", "$250–$1,000", "$1,000–$5,000", "$5,000+", "Not sure"] as const;
export const TIMING_OPTIONS = ["Today", "This week", "This month", "Flexible"] as const;
export const TAP_KINDS = ["call", "email", "website", "whatsapp"] as const;
export type TapKind = (typeof TAP_KINDS)[number];

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return t.slice(0, 40);
}

/** "Email or phone" is ONE field (keeps the form at 5 visible fields). */
export function splitContact(raw: string | null | undefined): { email: string | null; phone: string | null } {
  const t = (raw || "").trim();
  if (!t) return { email: null, phone: null };
  if (t.includes("@")) return { email: isValidEmail(t) ? t.toLowerCase() : null, phone: null };
  return { email: null, phone: normalizePhone(t) };
}

export function whatsappDigits(raw: string | null | undefined): string | null {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function firstName(name: string): string {
  return (name.trim().split(/\s+/)[0] || "Customer").slice(0, 40);
}

/** Subject: "New inquiry: <service> — <first name>" ([TEST] prefix on test leads). */
export function leadSubject(opts: { service?: string | null; need: string; name: string; test: boolean }): string {
  const what = (opts.service && opts.service.trim()) || opts.need.trim().replace(/\s+/g, " ").slice(0, 60);
  const s = `New inquiry: ${what} — ${firstName(opts.name)}`.replace(/[\r\n]+/g, " ");
  return opts.test ? `[TEST] ${s}` : s;
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`leadsplus:${verticalConfig.tablePrefix}:${ip}`).digest("hex").slice(0, 32);
}

export const LEADS_TABLE = `${verticalConfig.tablePrefix}leads`;
export const TAPS_TABLE = `${verticalConfig.tablePrefix}lead_taps`;
export const TAP_INC_RPC = `${verticalConfig.tablePrefix}lead_tap_inc`;

// Per-IP rate limit (no paid service): counted from the leads ledger itself.
export const RATE_LIMIT = { shortWindowMin: 10, shortMax: 3, dayMax: 10 };
// Owner "Send me a test lead": at most this many per listing per day.
export const TEST_LEADS_PER_DAY = 3;
