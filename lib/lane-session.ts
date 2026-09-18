import { safeEqual, sha256 } from "@/lib/lane-crypto";

/**
 * THE LANE'S OWN OWNER SESSION (spec §1.2, §4, §7.3).
 *
 * ── WHY NOT THE DIRECTORY'S OWNER AUTH ──────────────────────────────────────────────
 * `lib/auth.ts` authorises against `legal_listings.owner_auth_token` — a PLAINTEXT column
 * on the shared directory table, read and written by the claim funnel. A lane row is not
 * in that table and the lane mints NO claim credential, so it cannot reuse that mechanism;
 * and it must not copy its shape, because a SELECT on the lane table must never hand the
 * reader a live credential.
 *
 * Session state therefore lives on the lane row itself, as DIGESTS ONLY. One submitted
 * listing has exactly one submitter, by construction, so a per-row session is not a
 * simplification — it is the accurate shape.
 *
 * ── THE SEPARATION IS THE POINT ─────────────────────────────────────────────────────
 * The lane's cookies are NOT the directory's cookies, and the lane's owner surface lives
 * at `/owner/submitted/{slug}` — outside `/owner/[slug]`. A lane session can therefore
 * never be presented to the directory's owner routes, and a directory session can never be
 * presented to the lane's. Two independent mechanisms (the cookie NAMES and the URL space),
 * not one.
 *
 * Deliberately NOT `server-only`: pure decisions, driven directly by the harness.
 */

/** Distinct from `lib/auth.ts`'s cookie. Different surface, different door. */
export const LANE_SESSION_COOKIE = "dinla_submitted_session";
export const LANE_CSRF_COOKIE = "dinla_submitted_csrf";

export const LANE_SESSION_TTL_HOURS = 12;
/** The verify credential's life. 24h — the fleet's, not the claim funnel's 72h. */
export const LANE_VERIFY_TTL_HOURS = 24;

/**
 * Lane session cookies. BOTH `httpOnly` — including the CSRF secret, because the lane's
 * owner form is server-rendered and the server embeds the value as a hidden field, so the
 * page never needs to read it from JavaScript. `SameSite=Strict`.
 *
 * `NextResponse` is deliberately NOT imported: the parameter is structurally typed, so this
 * module stays importable from a plain `.mts` harness with no Next runtime.
 */
export function setLaneCookies(
  response: { cookies: { set(name: string, value: string, options: Record<string, unknown>): unknown } },
  input: { sessionSecret: string; csrfSecret: string; secure: boolean },
): void {
  const options = {
    httpOnly: true,
    secure: input.secure,
    sameSite: "strict" as const,
    path: "/",
    maxAge: LANE_SESSION_TTL_HOURS * 3600,
  };
  response.cookies.set(LANE_SESSION_COOKIE, input.sessionSecret, options);
  response.cookies.set(LANE_CSRF_COOKIE, input.csrfSecret, options);
}

export function clearLaneCookies(
  response: { cookies: { set(name: string, value: string, options: Record<string, unknown>): unknown } },
  secure: boolean,
): void {
  const options = { httpOnly: true, secure, sameSite: "strict" as const, path: "/", maxAge: 0 };
  response.cookies.set(LANE_SESSION_COOKIE, "", options);
  response.cookies.set(LANE_CSRF_COOKIE, "", options);
}

export interface LaneSessionRow {
  readonly submission_id: string;
  readonly slug: string;
  readonly owner_csrf_sha256: string | null;
  readonly expired: boolean;
  readonly revoked: boolean;
}

export type LaneSessionLookup =
  | { readonly ok: true; readonly submissionId: string; readonly slug: string; readonly csrfSha256: string }
  | { readonly ok: false; readonly code: string };

export interface LaneSessionStore {
  bySecretDigest(digest: string): Promise<LaneSessionRow | null>;
}

/** no-session → invalid → revoked → expired → ok. One order, one vocabulary. */
export async function loadLaneSession(
  sessionSecret: string | undefined,
  store: LaneSessionStore,
): Promise<LaneSessionLookup> {
  if (!sessionSecret || sessionSecret.trim() === "") return { ok: false, code: "NO_LANE_SESSION" };
  const row = await store.bySecretDigest(sha256(sessionSecret));
  if (!row) return { ok: false, code: "LANE_SESSION_INVALID" };
  if (row.revoked) return { ok: false, code: "LANE_SESSION_REVOKED" };
  if (row.expired) return { ok: false, code: "LANE_SESSION_EXPIRED" };
  return {
    ok: true,
    submissionId: row.submission_id,
    slug: row.slug,
    csrfSha256: row.owner_csrf_sha256 ?? "",
  };
}

/**
 * THE LANE AUTHORISATION PREDICATE — session valid ∧ bound to THIS submission ∧ the CSRF
 * double-submit matches.
 *
 * ⚠️ The CSRF comparison is over the DIGEST of the PRESENTED secret against the STORED
 * digest, because the row holds `owner_csrf_sha256` and never the secret itself. Comparing
 * the raw cookie to the stored digest would be a clean, silent, always-false check — and a
 * lock that never opens looks exactly like a lock that is never tried.
 *
 * 🔴 The presented value MUST come from the request BODY at the call site. See PS-L7: a
 * double-submit check works only because its two halves arrive over two channels an
 * attacker cannot both control. `body.csrf ?? cookie(LANE_CSRF_COOKIE)` collapses that to
 * one channel and always matches. That exact defect shipped on the donor plane and only an
 * end-to-end probe caught it, so the invariant is asserted at the call site, not here.
 */
export function authoriseLane(
  lookup: LaneSessionLookup,
  thisSubmissionId: string,
  csrfPresented: string,
): { ok: true } | { ok: false; code: string } {
  if (!lookup.ok) return { ok: false, code: lookup.code };
  if (lookup.submissionId !== thisSubmissionId) return { ok: false, code: "LANE_SESSION_WRONG_LISTING" };
  if (csrfPresented === "" || lookup.csrfSha256 === "") return { ok: false, code: "LANE_CSRF_MISSING" };
  if (!safeEqual(sha256(csrfPresented), lookup.csrfSha256)) return { ok: false, code: "LANE_CSRF_MISMATCH" };
  return { ok: true };
}
