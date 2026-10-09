// leads-plus-canary-v1 — OWNER CONTENT KIT v1. Pure logic, no I/O: safe to import from client and
// server, and written to be lifted as-is into another repo (swm-previews' lodging kit can adopt it —
// it shares no code with this directory beyond this file).
//
// Three labels, and only three:
//   "listing"   — From your listing. A FACT already on the row (or the owner's own words).
//   "suggested" — Suggested. An AI rewrite of listing/owner facts. It never adds a fact: every number,
//                 year, licence, award, price or place name in it must appear in its inputs, or the
//                 whole suggestion is DROPPED (never offered). Provenance = the source fields used.
//   "example"   — Example — replace me. Never publishes. Blocks ONLY its own section.
// Owner approval is the publish gate: nothing here renders on the public page until publishKit()
// output is written by the owner's explicit "Approve & publish".

export type KitLabel = "listing" | "suggested" | "example";
export type SectionKey =
  | "description" | "why_choose_us" | "services" | "service_areas" | "pricing"
  | "hours" | "faqs" | "offers" | "photos" | "contact_prefs";
export type Faq = { q: string; a: string };
export type KitValue = string | string[] | Faq[] | null;
export type KitStatus = "pending" | "accepted" | "deleted";

export type KitSection = {
  key: SectionKey;
  label: KitLabel;
  value: KitValue;
  status: KitStatus;
  provenance?: string[]; // source fields (suggested items) — stored, shown to the owner
  edited?: boolean;      // the owner typed this value themselves
};

// Kit profile (2026-10-09 lodging fix): a directory picks the section set that fits its businesses.
// "trade" (default) = the original sections, unchanged. "lodging" (guest houses, B&Bs) relabels services → "Rooms &
// amenities", pricing → "Rates", hours → "Check-in / check-out" (owner-typed; still never guessed) and drops
// "Service areas" (a guest house has a location, not a service area).
// leads-plus-fleet-fan-v1 (2026-10-09): + "campground" (sites, not rooms) and "outdoor" (ski resorts, heli/cat-ski and
// guided-trip operators: trips & packages, rates & seasons). Both drop "Service areas" and take owner-typed hours text,
// like lodging. "trade" and "lodging" are unchanged.
export type KitProfile = "trade" | "lodging" | "campground" | "outdoor";
export type KitDraft = { v: 1; sections: KitSection[]; updated_at: string; profile?: KitProfile };

// What the public page reads (lead_kit_published). Only accepted, non-example, non-empty sections.
export type PublishedKit = {
  v: 1;
  description?: string;
  why_choose_us?: string[];
  services?: string[];
  service_areas?: string[];
  pricing?: string[];
  hours?: null; // hours always render from hours_json (owner-set); the kit never stores guessed hours
  faqs?: Faq[];
  offers?: string[];
  photos?: string[];
  contact_buttons?: string[];
  stay_times?: string;   // lodging: the owner's own check-in / check-out wording (never guessed)
  published_at: string;
};

export const SECTION_TITLES: Record<SectionKey, string> = {
  description: "Description",
  why_choose_us: "Why choose us",
  services: "Services",
  service_areas: "Service areas",
  pricing: "Pricing / ranges",
  hours: "Hours",
  faqs: "FAQs",
  offers: "Offers",
  photos: "Photos",
  contact_prefs: "Contact preferences",
};
const PROFILE_TITLES: Record<KitProfile, Partial<Record<SectionKey, string>>> = {
  trade: {},
  lodging: { services: "Rooms & amenities", pricing: "Rates", hours: "Check-in / check-out" },
  campground: { services: "Sites & amenities", pricing: "Rates", hours: "Check-in / check-out" },
  outdoor: { services: "Trips & packages", pricing: "Rates & seasons", hours: "Season & hours" },
};
const PROFILE_OMIT: Record<KitProfile, SectionKey[]> = { trade: [], lodging: ["service_areas"], campground: ["service_areas"], outdoor: ["service_areas"] };
export const sectionTitle = (key: SectionKey, profile: KitProfile = "trade") => PROFILE_TITLES[profile][key] ?? SECTION_TITLES[key];
/** Hours are owner-typed text only on lodging ("Check-in 3 pm, check-out 11 am"); trade hours come from the hours editor. */
export const hoursEditable = (profile: KitProfile = "trade") => profile !== "trade";
// Example text per profile (examples never publish; they only show the owner what belongs in the section).
const EXAMPLE_SERVICE: Record<KitProfile, string> = {
  trade: "Example — replace me: a service you offer",
  lodging: "Example — replace me: a room type or an amenity guests get",
  campground: "Example — replace me: a site type (tent, RV hookup, cabin) or an amenity",
  outdoor: "Example — replace me: a trip, package or day you offer",
};
const EXAMPLE_PRICE: Record<KitProfile, string> = {
  trade: "Example — replace me: e.g. a typical job and its price range",
  lodging: "Example — replace me: e.g. a room and its nightly rate",
  campground: "Example — replace me: e.g. a site type and its nightly rate",
  outdoor: "Example — replace me: e.g. a package and its price, or your season dates",
};

export const SECTION_ORDER: SectionKey[] = [
  "description", "why_choose_us", "services", "service_areas", "pricing",
  "hours", "faqs", "offers", "photos", "contact_prefs",
];
export const LABEL_TEXT: Record<KitLabel, string> = {
  listing: "From your listing",
  suggested: "Suggested",
  example: "Example — replace me",
};

// Facts the kit may read. NEVER Google rating, review count/text/tags, identity attributes or Google
// photos — those columns are not part of this type, so they cannot leak in.
export type KitFacts = {
  name: string;
  city?: string | null;
  province_state?: string | null;
  description?: string | null;
  services?: string[] | null;
  service_area?: string[] | null;
  hours_text?: string | null;       // pre-formatted from the owner's hours_json; null = "Not set"
  year_established?: number | null;
  payment_methods?: string | null;
  owner_photo_urls?: string[] | null; // owner uploads only
  has_phone?: boolean;
  has_public_email?: boolean;
  has_website?: boolean;
  has_whatsapp?: boolean;
};

const nonEmpty = (a?: string[] | null) => (a ?? []).map((s) => s.trim()).filter(Boolean);

export function buildInitialDraft(f: KitFacts, now = new Date(), profile: KitProfile = "trade"): KitDraft {
  const ex = (key: SectionKey, value: KitValue): KitSection => ({ key, label: "example", value, status: "pending" });
  const fact = (key: SectionKey, value: KitValue): KitSection => ({ key, label: "listing", value, status: "pending" });
  const services = nonEmpty(f.services);
  const areas = nonEmpty(f.service_area);
  const photos = nonEmpty(f.owner_photo_urls);
  const buttons = [
    ...(f.has_phone ? ["call"] : []),
    ...(f.has_public_email ? ["email"] : []),
    ...(f.has_website ? ["website"] : []),
    ...(f.has_whatsapp ? ["whatsapp"] : []),
  ];
  const sections: KitSection[] = [
    f.description?.trim() ? fact("description", f.description.trim())
      : ex("description", "Example — replace me: two or three sentences on what you do and who you do it for."),
    ex("why_choose_us", ["Example — replace me: a real reason customers pick you", "Example — replace me: another real reason"]),
    services.length ? fact("services", services)
      : ex("services", [EXAMPLE_SERVICE[profile]]),
    areas.length ? fact("service_areas", areas)
      : f.city ? fact("service_areas", [f.city]) : ex("service_areas", ["Example — replace me: a town you serve"]),
    ex("pricing", [EXAMPLE_PRICE[profile]]),
    // Hours are never guessed: owner-set hours or "Not set".
    fact("hours", f.hours_text?.trim() ? f.hours_text.trim() : null),
    ex("faqs", [{ q: "Example — replace me: a question customers often ask", a: "Example — replace me: your answer" }]),
    ex("offers", ["Example — replace me: a current offer, or delete this section"]),
    photos.length ? fact("photos", photos) : ex("photos", null),
    fact("contact_prefs", buttons),
  ];
  const omit = PROFILE_OMIT[profile];
  return { v: 1, sections: sections.filter((s) => !omit.includes(s.key)), updated_at: now.toISOString(), profile };
}

/** Deterministic, fact-only FAQ suggestions (no model call). */
export function suggestFaqs(f: KitFacts): { value: Faq[]; provenance: string[] } | null {
  const faqs: Faq[] = [];
  const prov: string[] = [];
  const services = nonEmpty(f.services);
  const areas = nonEmpty(f.service_area);
  if (services.length) { faqs.push({ q: "What services do you offer?", a: `${services.join(", ")}.` }); prov.push("services"); }
  if (areas.length) { faqs.push({ q: "Which areas do you serve?", a: `${areas.join(", ")}.` }); prov.push("service_area"); }
  if (f.hours_text?.trim()) { faqs.push({ q: "What are your hours?", a: f.hours_text.trim() }); prov.push("hours_json"); }
  if (f.payment_methods?.trim()) { faqs.push({ q: "How can I pay?", a: f.payment_methods.trim() }); prov.push("payment_methods"); }
  return faqs.length ? { value: faqs, provenance: prov } : null;
}

// ── Forbidden-claims check ───────────────────────────────────────────────────────────────────
// Any number, year, licence, award, price or place name in the OUTPUT that is absent from the INPUTS
// ⇒ the suggestion is dropped (returns the violations; caller drops on any).
const CLAIM_WORDS = [
  "licensed", "licenced", "license", "licence", "certified", "certification", "insured", "bonded",
  "award", "awarded", "award-winning", "accredited", "guarantee", "guaranteed", "warranty", "bbb",
  "#1", "number one", "best", "top-rated", "top rated", "master electrician", "years of experience",
  "family-owned", "family owned", "veteran", "since",
];
const COMMON_CAPS = new Set([
  "I", "We", "Our", "Us", "You", "Your", "The", "A", "An", "And", "Or", "For", "With", "From", "At", "In", "On",
  "To", "Of", "By", "Call", "Contact", "Get", "Whether", "From", "Every", "Each", "No", "Yes", "If", "When", "Need",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "EV", "LED", "AC", "DC", "FAQ",
]);

export function forbiddenClaims(output: string, inputs: string): string[] {
  const inLow = inputs.toLowerCase();
  const inNums = new Set((inputs.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")));
  const bad: string[] = [];
  for (const raw of output.match(/\d[\d,.]*/g) || []) {
    const n = raw.replace(/[,.]+$/, "").replace(/,/g, "");
    if (!inNums.has(n)) bad.push(`number:${n}`);
  }
  if (/[$€£]/.test(output) && !/[$€£]/.test(inputs)) bad.push("price-symbol");
  const outLow = output.toLowerCase();
  for (const w of CLAIM_WORDS) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\#]/g, "\\$&")}([^a-z]|$)`);
    if (re.test(outLow) && !re.test(inLow)) bad.push(`claim:${w}`);
  }
  // Place names / proper nouns: a capitalized word not at a sentence start and not in the inputs.
  const sentences = output.split(/(?<=[.!?])\s+|\n+/);
  for (const s of sentences) {
    const words = s.trim().split(/\s+/);
    words.forEach((w, i) => {
      const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, "");
      if (!clean || i === 0 || !/^[A-Z]/.test(clean) || COMMON_CAPS.has(clean)) return;
      if (!inLow.includes(clean.toLowerCase())) bad.push(`proper-noun:${clean}`);
    });
  }
  return Array.from(new Set(bad));
}

/** Input text used for both the model prompt and the claims check, plus its provenance fields. */
export function factsInput(f: KitFacts): { text: string; fields: string[] } {
  const parts: [string, string | null | undefined][] = [
    ["name", f.name],
    ["city", [f.city, f.province_state].filter(Boolean).join(", ")],
    ["description", f.description],
    ["services", nonEmpty(f.services).join(", ")],
    ["service_area", nonEmpty(f.service_area).join(", ")],
    ["year_established", f.year_established ? String(f.year_established) : null],
    ["payment_methods", f.payment_methods],
  ];
  const used = parts.filter(([, v]) => v && String(v).trim());
  return { text: used.map(([k, v]) => `${k}: ${v}`).join("\n"), fields: used.map(([k]) => k) };
}

/** Accept a model output for a section only if it passes the claims check. */
export function vetSuggestion(key: "description" | "why_choose_us", output: string | string[], f: KitFacts):
  { ok: true; section: KitSection } | { ok: false; violations: string[] } {
  const { text, fields } = factsInput(f);
  const joined = Array.isArray(output) ? output.join("\n") : output;
  if (!joined.trim()) return { ok: false, violations: ["empty"] };
  const v = forbiddenClaims(joined, text);
  if (v.length) return { ok: false, violations: v };
  return { ok: true, section: { key, label: "suggested", value: output, status: "pending", provenance: fields } };
}

// ── Owner actions ────────────────────────────────────────────────────────────────────────────
export type KitAction =
  | { op: "accept"; key: SectionKey }
  | { op: "delete"; key: SectionKey }
  | { op: "edit" | "replace"; key: SectionKey; value: KitValue }
  | { op: "accept_all_listing" };

export function applyAction(d: KitDraft, a: KitAction, now = new Date()): KitDraft {
  const sections = d.sections.map((s) => {
    if (a.op === "accept_all_listing") return s.label === "listing" && s.status === "pending" ? { ...s, status: "accepted" as const } : s;
    if (s.key !== a.key) return s;
    switch (a.op) {
      case "accept": return { ...s, status: "accepted" as const };
      case "delete": return { ...s, status: "deleted" as const };
      // The owner's own words: a fact by definition ("From your listing"), never an example.
      case "edit":
      case "replace": return { ...s, value: sanitizeValue(s.key, a.value), label: "listing" as const, edited: true, status: "accepted" as const, provenance: ["owner"] };
    }
  });
  return { ...d, sections, updated_at: now.toISOString() };
}

const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
export function sanitizeValue(key: SectionKey, v: KitValue): KitValue {
  if (v == null) return null;
  if (key === "faqs") {
    return (Array.isArray(v) ? v : []).filter((x): x is Faq => typeof x === "object" && x !== null && "q" in x)
      .map((x) => ({ q: clip(String(x.q), 200), a: clip(String(x.a), 1000) })).filter((x) => x.q && x.a).slice(0, 10);
  }
  if (key === "description" || key === "hours") return typeof v === "string" ? v.trim().slice(0, 2000) : null;
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return (arr as unknown[]).map((x) => clip(String(x), 300)).filter(Boolean).slice(0, 20);
}

const looksExample = (v: KitValue) => JSON.stringify(v ?? "").includes("Example — replace me");

/** Which sections an approval would publish, and which are blocked (only their own section). */
export function publishPreview(d: KitDraft): { publish: SectionKey[]; blocked: SectionKey[] } {
  const publish: SectionKey[] = [];
  const blocked: SectionKey[] = [];
  for (const s of d.sections) {
    if (s.status !== "accepted") continue;
    if (s.label === "example" || looksExample(s.value)) { blocked.push(s.key); continue; }
    if (s.value == null || (Array.isArray(s.value) && s.value.length === 0)) continue;
    publish.push(s.key);
  }
  return { publish, blocked };
}

export function publishKit(d: KitDraft, now = new Date()): PublishedKit {
  const { publish } = publishPreview(d);
  const out: PublishedKit = { v: 1, published_at: now.toISOString() };
  for (const s of d.sections) {
    if (!publish.includes(s.key)) continue;
    switch (s.key) {
      case "description": out.description = s.value as string; break;
      case "why_choose_us": out.why_choose_us = s.value as string[]; break;
      case "services": out.services = s.value as string[]; break;
      case "service_areas": out.service_areas = s.value as string[]; break;
      case "pricing": out.pricing = s.value as string[]; break;
      case "faqs": out.faqs = s.value as Faq[]; break;
      case "offers": out.offers = s.value as string[]; break;
      case "photos": out.photos = s.value as string[]; break;
      case "contact_prefs": out.contact_buttons = (s.value as string[]).filter((b) => ["call", "email", "website", "whatsapp"].includes(b)); break;
      // Trade hours never come from the kit (they render from hours_json). Lodging check-in / check-out is the
      // owner's own typed wording — published only when the owner edited it.
      case "hours": if (s.edited && typeof s.value === "string" && s.value.trim()) out.stay_times = s.value.trim(); break;
    }
  }
  return out;
}

export function isKitDraft(x: unknown): x is KitDraft {
  return !!x && typeof x === "object" && (x as KitDraft).v === 1 && Array.isArray((x as KitDraft).sections);
}
