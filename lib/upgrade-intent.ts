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

/** TDL #1369: the choice as a suffix for a mailed link ("" when none) — `&plan=leads-plus&cycle=monthly&mode=…`. */
export const intentLinkSuffix = (i: UpgradeIntent | null) => (i ? `&${intentQuery(i)}` : "");

/** TDL #1369: the choice behind a claim / login request — the page URL it was sent from (Referer) first, then the
 *  lp_intent cookie. Takes the NextRequest shape structurally so this file stays free of server imports. */
export function intentFromRequest(req: {
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
}): UpgradeIntent | null {
  let fromUrl: UpgradeIntent | null = null;
  try {
    const ref = req.headers.get("referer");
    if (ref) fromUrl = parseUpgradeIntent((k) => new URL(ref).searchParams.get(k));
  } catch {
    // unparseable Referer — the cookie decides
  }
  return fromUrl ?? intentFromCookie(req.cookies.get(UPGRADE_INTENT_COOKIE)?.value);
}
