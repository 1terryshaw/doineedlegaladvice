// leads-plus-canary-v1 — gate, entitlement, subject, forbidden-claims and kit publish rules.
import assert from "node:assert/strict";
import test from "node:test";
import { leadFormGate, hasLeadsPlus, leadSubject, splitContact, websiteLinkable } from "../lib/leads-plus";
import { forbiddenClaims, buildInitialDraft, applyAction, publishPreview, publishKit, vetSuggestion } from "../lib/content-kit";

const paid = { tier: "reviews_plus", subscription_tier: "reviews_plus", claimed: true, owner_email: "owner@realbiz.com", leads_plus_enabled: true };

test("entitlement: Reviews Plus and every tier above grant Leads Plus; free does not (R1/R2/R9 + migration)", () => {
  for (const t of ["reviews_plus", "reviews", "leads_plus", "website", "growth"]) assert.equal(hasLeadsPlus({ tier: t }), true, t);
  for (const t of ["free", "seed", "claimed", "payment_error_review", null]) assert.equal(hasLeadsPlus({ tier: t }), false, String(t));
  // subscription_tier governs when present (getEffectiveTier)
  assert.equal(hasLeadsPlus({ tier: "free", subscription_tier: "reviews_plus" }), true);
});

test("form gate: claimed AND email confirmed AND leads_plus AND leads_plus_enabled", () => {
  assert.deepEqual(leadFormGate(paid), { ok: true });
  assert.equal(leadFormGate({ ...paid, leads_plus_enabled: false }).ok, false); // canary gate
  assert.equal(leadFormGate({ ...paid, leads_plus_enabled: null }).ok, false);
  assert.equal(leadFormGate({ ...paid, claimed: false }).ok, false); // R10
  assert.equal(leadFormGate({ ...paid, tier: "free", subscription_tier: "free" }).ok, false); // R9
  assert.equal(leadFormGate({ ...paid, owner_email: "john@doe.com" }).ok, false); // unconfirmed/junk
  assert.equal(leadFormGate(null).ok, false);
});

test("subject: New inquiry: <service> — <first name>, [TEST] on tests", () => {
  assert.equal(leadSubject({ service: "Panel upgrades", need: "x", name: "Maria Lopez", test: false }), "New inquiry: Panel upgrades — Maria");
  assert.equal(leadSubject({ service: null, need: "Outlet sparks", name: "Bo", test: true }), "[TEST] New inquiry: Outlet sparks — Bo");
});

test("contact field splits email vs phone; junk rejected", () => {
  assert.deepEqual(splitContact("Maria@Example.org"), { email: "maria@example.org", phone: null });
  assert.deepEqual(splitContact("(555) 010-0199"), { email: null, phone: "(555) 010-0199" });
  assert.deepEqual(splitContact("12"), { email: null, phone: null });
});

test("dead / parked websites are never linked", () => {
  assert.equal(websiteLinkable("https://x.com", "ALIVE_200"), true);
  assert.equal(websiteLinkable("https://x.com", "DEAD_DNS"), false);
  assert.equal(websiteLinkable("https://x.com", "STRUCTURAL_DEAD"), false);
  assert.equal(websiteLinkable("x.com", null), false);
});

test("forbidden claims: numbers, years, licences, awards, prices, place names absent from inputs are caught", () => {
  const inputs = "name: Bright Spark Electric\ncity: Austin, TX\nservices: Panel upgrades, Lighting";
  assert.deepEqual(forbiddenClaims("Bright Spark Electric handles panel upgrades and lighting in Austin.", inputs), []);
  const v = forbiddenClaims("Licensed and insured since 1998, serving Dallas. Panels from $99. Award-winning.", inputs);
  for (const want of ["number:1998", "claim:licensed", "claim:insured", "proper-noun:Dallas", "price-symbol", "claim:award-winning"]) {
    assert.ok(v.includes(want), `missing ${want} in ${v}`);
  }
  const f = { name: "Bright Spark Electric", city: "Austin", services: ["Panel upgrades"] };
  assert.equal(vetSuggestion("description", "Serving Austin since 2001.", f).ok, false); // dropped, not offered
  assert.equal(vetSuggestion("description", "Bright Spark Electric does panel upgrades in Austin.", f).ok, true);
});

test("kit: examples never publish and block only their own section; hours never guessed", () => {
  let d = buildInitialDraft({ name: "Demo", services: ["Lighting"], description: "We fix lights." });
  assert.equal(d.sections.find((s) => s.key === "hours")!.value, null); // "Not set"
  d = applyAction(d, { op: "accept_all_listing" });
  d = applyAction(d, { op: "accept", key: "pricing" }); // accepting an example does not publish it
  const p = publishPreview(d);
  assert.ok(p.publish.includes("description") && p.publish.includes("services"));
  assert.ok(p.blocked.includes("pricing"));
  const k = publishKit(d);
  assert.equal(k.pricing, undefined);
  assert.equal(k.description, "We fix lights.");
  assert.ok(!JSON.stringify(k).includes("Example — replace me"));
  d = applyAction(d, { op: "replace", key: "pricing", value: ["Outlet repair: call for a quote"] });
  assert.deepEqual(publishKit(d).pricing, ["Outlet repair: call for a quote"]);
});

test("dashboard plan label comes from the subscription price, not the tier slug", async () => {
  const { planName } = await import("../lib/plan-info");
  const { formatCharge } = await import("../lib/plan-format");
  assert.equal(planName("price_1UObHCB4nhVx1nmU7yb9XJkY"), "Leads Plus");
  assert.equal(planName("price_1TWCWhB4nhVx1nmU7e5wn3EI"), "Leads Plus (Reviews Plus legacy)");
  assert.equal(planName("price_other", null, "leads_plus"), "Leads Plus");
  assert.equal(formatCharge({ amount: 1900, currency: "usd", interval: "month" }), "$19 USD/mo");
  assert.equal(formatCharge({ amount: 2811, currency: "cad", interval: "month" }), "$28.11 CAD/mo");
});

test("fixup-2 guard: no client component imports a module that constructs the Stripe client", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const files: string[] = [];
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.tsx?$/.test(e.name)) files.push(f); } };
  walk("components"); walk("app");
  const bad = files.filter((f) => { const src = fs.readFileSync(f, "utf8"); return /^["']use client["']/m.test(src) && /from ["']@\/lib\/(stripe|plan-info)["']/.test(src); });
  assert.deepEqual(bad, []);
});

test("kit profile: lodging relabels, drops service areas, lets the owner type check-in/out; trade unchanged", async () => {
  const { buildInitialDraft, applyAction, publishKit, sectionTitle } = await import("../lib/content-kit");
  const trade = buildInitialDraft({ name: "T", city: "X" });
  assert.ok(trade.sections.some((s) => s.key === "service_areas"));
  assert.equal(sectionTitle("services"), "Services");
  let d = buildInitialDraft({ name: "Demo Guest House", city: "Demo City", description: "A quiet guest house." }, new Date(), "lodging");
  assert.equal(d.profile, "lodging");
  assert.ok(!d.sections.some((s) => s.key === "service_areas"));
  assert.equal(sectionTitle("services", "lodging"), "Rooms & amenities");
  assert.equal(d.sections.find((s) => s.key === "hours")!.value, null); // never guessed
  assert.equal(publishKit(d).stay_times, undefined);
  d = applyAction(d, { op: "edit", key: "hours", value: "Check-in 3 pm, check-out 11 am" });
  d = applyAction(d, { op: "replace", key: "services", value: ["Queen room", "Free parking"] });
  const k = publishKit(d);
  assert.equal(k.stay_times, "Check-in 3 pm, check-out 11 am");
  assert.deepEqual(k.services, ["Queen room", "Free parking"]);
});
