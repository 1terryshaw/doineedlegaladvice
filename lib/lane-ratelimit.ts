/**
 * THE LANE'S RATE LIMITER (spec §5.1 step 5).
 *
 * ── 🔴 THIS REPO'S OWN DONOR FAILS OPEN. THIS ONE DOES NOT. ──────────────────────────
 * `app/api/removal-request/route.ts:102-118` wraps its whole limiter in `if (ip) { … }`
 * and then counts on `requester_email` INSIDE that block — so a request with no
 * `X-Forwarded-For` is not rate-limited at all. On that route it is a pre-existing
 * nuisance (a removal request delists nothing). On the FIRST public unauthenticated
 * self-PUBLISH endpoint this site has ever had it would be the bypass, and "send no
 * X-Forwarded-For" is not an attack that requires any skill.
 *
 * So: NO CLIENT ADDRESS ⇒ RATE-LIMITED, never exempt (`feedback_safety_flags_fail_closed`).
 * That is the one substantive behavioural divergence from the donor, and it is the point
 * of the file. The lane deliberately does NOT copy the donor's shape.
 *
 * The counter is injected, so the ladder is a pure decision testable with no database.
 */

/** Max self-serve submissions per client address per window. */
export const RATE_LIMIT = 3;
export const WINDOW_HOURS = 24;

/**
 * The client address, from the platform's own forwarding headers.
 *
 * `x-forwarded-for` is a LIST and the client is the FIRST entry; taking the last would
 * take the nearest proxy and rate-limit the whole edge as one caller. Returns null when
 * there is nothing usable — and null is REFUSED upstream, never exempted.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? real : null;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly code: string;
  readonly recent: number;
}

/** Counts lane rows from this address inside the window. Injected; the store implements it. */
export type RecentCount = (ip: string, windowHours: number) => Promise<number>;

export async function checkRateLimit(ip: string | null, count: RecentCount): Promise<RateLimitDecision> {
  // FAIL CLOSED. See the header — this is the divergence, and it is the point of the file.
  if (ip === null || ip.trim() === "") {
    return { allowed: false, code: "RATE_LIMIT_NO_CLIENT_ADDRESS", recent: RATE_LIMIT };
  }
  let recent: number;
  try {
    recent = await count(ip, WINDOW_HOURS);
  } catch {
    // A limiter that cannot count has not established that the caller is under the limit.
    // Refusing is recoverable (the submitter retries); waving through is not.
    return { allowed: false, code: "RATE_LIMIT_UNAVAILABLE", recent: RATE_LIMIT };
  }
  if (recent >= RATE_LIMIT) return { allowed: false, code: "RATE_LIMITED", recent };
  return { allowed: true, code: "", recent };
}

export const RATE_LIMIT_MESSAGE =
  "You've submitted a few listings recently — please give it 24 hours before submitting another.";
