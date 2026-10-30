// leads-plus-claim-continuity-v1 (TDL #1360): the owner's Leads Plus choice ("Start free 30-day trial" / "Pay now") carried
// from the CTA through /claim → verify → login → owner dashboard, which then opens that checkout itself.
// The choice rides in the URL (?plan=leads-plus&mode=trial|direct&cycle=monthly) and, across the claim e-mail round trip, in a
// first-party cookie set on arrival (components/UpgradeIntentCapture.tsx). Client-safe: no server imports.
export type UpgradeIntent = { plan: "leads-plus"; mode: "trial" | "direct"; cycle: "monthly" };

export const UPGRADE_INTENT_COOKIE = "lp_intent";
export const UPGRADE_INTENT_MAX_AGE = 7 * 24 * 60 * 60; // the claim verify link's lifetime

/** From URL params. Leads Plus is monthly only (R5); `paynow` / `pay-now` are accepted for `direct`. */
export function parseUpgradeIntent(get: (key: string) => string | null | undefined): UpgradeIntent | null {
  const plan = (get("plan") || "").toLowerCase().replace("_", "-");
  if (plan !== "leads-plus") return null;
  const m = (get("mode") || "").toLowerCase();
  const mode = m === "trial" ? "trial" : m === "direct" || m === "paynow" || m === "pay-now" ? "direct" : null;
  return mode ? { plan: "leads-plus", mode, cycle: "monthly" } : null;
}

export const intentCookieValue = (i: UpgradeIntent) => `${i.plan}:${i.mode}`;

export function intentFromCookie(value: string | null | undefined): UpgradeIntent | null {
  const [plan, mode] = (value || "").split(":");
  return parseUpgradeIntent((k) => (k === "plan" ? plan : k === "mode" ? mode : null));
}

export const intentQuery = (i: UpgradeIntent) => `plan=${i.plan}&cycle=${i.cycle}&mode=${i.mode}`;
