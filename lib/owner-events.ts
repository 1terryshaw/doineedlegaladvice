// owner-funnel-recovery-p1p4-v1 P4 (2026-09-26) — owner session durability + attempt instrumentation.
//
// Writes to three service_role-only tables (RLS on, no policies, anon/authenticated revoked):
//   owner_auth_events          one row per observable login/session event
//   owner_session_meta         sha256(token) → first seen / renewals / revocation (sliding-session cap)
//   owner_gbp_connect_attempts one row per /api/owner/gbp-connect call (outcome class + URL host class)
// NEVER stored: tokens (only sha256), plaintext email (only a keyed HMAC), IPs, link URLs, field values.
// Every function is FAIL-OPEN: instrumentation can never block or break a login, a session, or a save.
import { createHash, createHmac } from "crypto";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { gbpConnectResult } from "@/lib/gbp-connect-result";

export type OwnerAuthEvent =
  | "link_requested" | "link_sent" | "link_clicked" | "link_expired" | "link_reused" | "link_invalid"
  | "session_created" | "session_refused" | "session_renewed";

const REPO = process.env.VERCEL_GIT_REPO_SLUG || process.env.VERCEL_PROJECT_PRODUCTION_URL || null;
const DAY = 24 * 60 * 60 * 1000;
// Sliding session (P4.1): active use renews the token's expiry to now + SESSION_WINDOW once it is inside
// the RENEW_WHEN_LEFT window, never past first_seen + SESSION_ABSOLUTE_CAP. Revocation: owner_session_meta
// .revoked_at (or nulling owner_auth_token) ends the session server-side on the next request.
export const SESSION_WINDOW_MS = 30 * DAY;
export const RENEW_WHEN_LEFT_MS = 7 * DAY;
export const SESSION_ABSOLUTE_CAP_MS = 90 * DAY;

export function emailHmac(email: unknown): string | null {
  const key = process.env.OWNER_EVENT_HMAC_KEY;
  const e = String(email ?? "").trim().toLowerCase();
  if (!key || !e) return null;
  return createHmac("sha256", key).update(e).digest("hex").slice(0, 32);
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function withTimeout<T>(p: PromiseLike<T>, ms = 1500): Promise<T | null> {
  return Promise.race([Promise.resolve(p), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function logOwnerAuthEvent(
  event: OwnerAuthEvent,
  o: { slug?: string | null; email?: unknown; detail?: string | null } = {},
): Promise<void> {
  try {
    await withTimeout(supabaseAdmin.from("owner_auth_events").insert({
      event, repo: REPO, listing_table: LISTINGS_TABLE, listing_slug: o.slug ? String(o.slug).slice(0, 200) : null,
      email_hmac: emailHmac(o.email), detail: o.detail ? String(o.detail).slice(0, 60) : null,
    }));
  } catch { /* fail-open */ }
}

/** First sight of a token → session_created (returns false); seen before → true (a reused link). */
export async function recordSessionStart(slug: string, token: string): Promise<boolean> {
  try {
    const h = tokenHash(token);
    const { data } = (await withTimeout(supabaseAdmin.from("owner_session_meta").select("token_sha256").eq("token_sha256", h).maybeSingle())) ?? { data: null };
    if (data) return true;
    await withTimeout(supabaseAdmin.from("owner_session_meta").insert({ token_sha256: h, listing_table: LISTINGS_TABLE, listing_slug: slug }));
    return false;
  } catch { return false; }
}

/**
 * Sliding renewal on ACTIVE use of an owner session that has already been authorised by the caller.
 * Returns "revoked" when the session was revoked server-side (the caller must then refuse it).
 */
export async function touchOwnerSession(
  slug: string,
  token: string,
  expiresAt: string | null | undefined,
): Promise<"ok" | "renewed" | "revoked"> {
  try {
    const h = tokenHash(token);
    const res = await withTimeout(supabaseAdmin.from("owner_session_meta").select("first_seen_at, revoked_at, renew_count").eq("token_sha256", h).maybeSingle());
    const meta = (res as { data?: { first_seen_at: string; revoked_at: string | null; renew_count: number } | null } | null)?.data ?? null;
    if (meta?.revoked_at) {
      await logOwnerAuthEvent("session_refused", { slug, detail: "revoked" });
      return "revoked";
    }
    const exp = expiresAt ? Date.parse(expiresAt) : NaN;
    if (!Number.isFinite(exp)) return "ok";                      // non-expiring legacy token: nothing to slide
    const now = Date.now();
    if (exp <= now) return "ok";                                 // never resurrect an expired token
    if (exp - now > RENEW_WHEN_LEFT_MS) return "ok";             // plenty left: no write on ordinary use
    const firstSeen = meta ? Date.parse(meta.first_seen_at) : now;
    const cap = firstSeen + SESSION_ABSOLUTE_CAP_MS;
    const next = Math.min(now + SESSION_WINDOW_MS, cap);
    if (next <= exp) return "ok";                                // absolute cap reached: let it lapse
    const upd = await withTimeout(supabaseAdmin.from(LISTINGS_TABLE)
      .update({ owner_auth_token_expires_at: new Date(next).toISOString() })
      .eq("slug", slug).eq("owner_auth_token", token));
    if ((upd as { error?: unknown } | null)?.error) return "ok";
    if (meta) {
      await withTimeout(supabaseAdmin.from("owner_session_meta").update({ last_renewed_at: new Date(now).toISOString(), renew_count: (meta.renew_count ?? 0) + 1 }).eq("token_sha256", h));
    } else {
      await withTimeout(supabaseAdmin.from("owner_session_meta").insert({ token_sha256: h, listing_table: LISTINGS_TABLE, listing_slug: slug, last_renewed_at: new Date(now).toISOString(), renew_count: 1 }));
    }
    await logOwnerAuthEvent("session_renewed", { slug });
    return "renewed";
  } catch { return "ok"; }
}

/** For legacy auth routes without lib/auth's isOwnerTokenExpired: true only for a parseable past expiry. */
export function tokenPastExpiry(expiresAt: string | null | undefined): boolean {
  const t = expiresAt ? Date.parse(expiresAt) : NaN;
  return Number.isFinite(t) && t < Date.now();
}

export function gbpUrlHostClass(url: unknown): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "missing";
  let host = "";
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return "not_google"; }
  if (host === "maps.app.goo.gl" || host === "goo.gl") return "maps_short";
  if (host === "g.page") return "g_page";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) {
    try { const p = new URL(raw).pathname; if (p.startsWith("/maps")) return "google_maps"; if (p.startsWith("/search")) return "google_search"; } catch {}
    return "other_google";
  }
  if (host.startsWith("maps.google.")) return "google_maps";
  return "not_google";
}

export async function logGbpConnectAttempt(status: number, body: unknown, req: { slug?: unknown; gbpUrl?: unknown } | null): Promise<void> {
  try {
    const b = (body && typeof body === "object" ? body : null) as { chij?: unknown } | null;
    const outcome = gbpConnectResult(status, b as never).outcome;
    await withTimeout(supabaseAdmin.from("owner_gbp_connect_attempts").insert({
      repo: REPO, listing_table: LISTINGS_TABLE, listing_slug: typeof req?.slug === "string" ? req.slug.slice(0, 200) : null,
      http_status: status, outcome, chij_outcome: typeof b?.chij === "string" ? b.chij.slice(0, 40) : null,
      url_host_class: gbpUrlHostClass(req?.gbpUrl),
    }));
  } catch { /* fail-open */ }
}
