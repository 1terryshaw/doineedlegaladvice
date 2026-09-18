/**
 * THE LANE'S BOT PROTECTION (spec §7.1, R-5; D-2 ruled BASIC).
 *
 * ── FOUR LAYERS, FLOOR FIRST ────────────────────────────────────────────────────────
 *   L1  honeypot field + a minimum form-fill dwell time      (free) — catches the naive
 *       majority, and its refusal LOOKS LIKE SUCCESS, which is what makes it worth having.
 *   L2  email-verify before publish, as a CHECK CONSTRAINT   (free) — the real floor. A bot
 *       that beats every other layer still has to RECEIVE MAIL.
 *   L3  fail-closed IP rate limit, 3/24h, no-address ⇒ limited (free).
 *   L4  Vercel BotID `checkBotId()` on the two POST intakes  (Basic: free on all plans) —
 *       the only layer that sees a headless browser which solves L1–L3.
 *
 * 🔴 DEEP ANALYSIS IS NOT ENABLED. It is billable ($1/1,000 checks on Pro) on a public
 * unauthenticated endpoint, and CLAUDE.md's standing rule is that no new per-call charge
 * ships without an explicit line from Terry. D-2 ruled BASIC; Deep Analysis is deferred until
 * submission volume justifies it, at which point the honest number is ~$0.001 per submission.
 *
 * 🔴 THE TWO LISTS MUST BE EDITED TOGETHER. A route not present in `LANE_PROTECTED_ROUTES`
 * (which `app/layout.tsx` feeds to `<BotIdClient protect>`) makes `checkBotId()` on that route
 * FAIL — the client never armed it. `verify:lane-logic` asserts the layout's list and the set
 * of routes that call `checkBotId` are the same set, so they cannot drift apart silently.
 */
export const LANE_PROTECTED_ROUTES = [
  { path: "/api/list-your-business", method: "POST" },
  { path: "/api/list-your-business/resend", method: "POST" },
] as const;

export interface BotVerdict {
  /** 'human' | 'unchecked' | 'bypass:<why>' — recorded on the row and in the history audit. */
  readonly botCheck: string;
  readonly refuse: boolean;
}

/**
 * Wraps `checkBotId()` so a lane route never has to decide what an exception means.
 *
 * ⚠️ AN OUTAGE IS NOT A BOT. If the check itself throws (BotID unavailable, misconfigured,
 * running in a local dev server), the request is ALLOWED and recorded as `unchecked` — L2's
 * email verification still stands between the caller and publication, so failing open HERE
 * does not fail open overall. Failing closed here would take the intake down whenever a
 * third-party service blinked, which is a worse trade for a layer that is not the floor.
 */
export async function laneBotCheck(): Promise<BotVerdict> {
  try {
    const { checkBotId } = await import("botid/server");
    const verdict = await checkBotId();
    if (verdict.isBot) return { botCheck: "bot", refuse: true };
    return { botCheck: "human", refuse: false };
  } catch (e) {
    console.warn("[lane] botid check unavailable — allowing, recorded as unchecked:", e instanceof Error ? e.message : e);
    return { botCheck: "unchecked", refuse: false };
  }
}

/**
 * L1 — the honeypot and the dwell time, as a pure decision.
 *
 * 🔴 A HONEYPOT HIT RETURNS SUCCESS. The caller responds exactly as it would to a real
 * submission and writes NOTHING. A refusal that announces itself teaches the next attempt
 * which field to leave alone.
 */
export const HONEYPOT_FIELD = "company_website_confirm";
export const MIN_DWELL_MS = 2500;

export function honeypotTripped(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim() !== "";
}

export function dwellTooFast(renderedAtMs: unknown, nowMs: number): boolean {
  const t = typeof renderedAtMs === "number" ? renderedAtMs : Number(renderedAtMs);
  // An absent or unparseable stamp is NOT treated as too fast: a legitimate submitter with
  // JavaScript disabled has no stamp, and refusing them would make the honeypot a JS gate.
  if (!Number.isFinite(t) || t <= 0) return false;
  return nowMs - t < MIN_DWELL_MS;
}
