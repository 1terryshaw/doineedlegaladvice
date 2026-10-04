// empire-vitals-fix-v1 (Part A) — rate limiter for POST /api/claim (claim START) ONLY.
// Mirrors lib/owner-login-ratelimit.ts: the route calls this BEFORE sendClaimEmail, nothing else
// imports it, so outreach / lifecycle mail can never be throttled (or slowed) by it.
//
// Limits (enforced atomically in Postgres by claim_start_rate_check, table claim_start_rate_limits):
//   5 claim starts per client IP per hour (every start that reaches the send gate counts), and
//   3 claim-verify SENDS per recipient email per rolling 24h, ESTATE-WIDE (keyed on the email hash
//   alone, so a recipient is capped across every vertical that adopts this limiter).
// Keys are plain sha256 of the normalized email / IP — raw values are never stored.
// FAIL-OPEN: any error (or a >1.5 s stall) returns { verdict: "ok", error } so a real claimant is
// never stranded; the route raises the sentinel alert.
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientIp } from "@/lib/owner-login-ratelimit";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const TIMEOUT_MS = 1500;

export type ClaimStartVerdict = "ok" | "ip_cap" | "email_cap";
export type ClaimStartRateResult = { verdict: ClaimStartVerdict; error?: string };

/**
 * willSend=false: the start will NOT send (a verify token is already pending on the listing) —
 * it still counts toward the IP cap, but never toward the recipient's send cap.
 */
export async function checkClaimStartRate(
  email: unknown,
  req: NextRequest,
  willSend: boolean,
): Promise<ClaimStartRateResult> {
  try {
    const emailHash = sha256(String(email).trim().toLowerCase());
    const ip = clientIp(req);
    // Fault-injection hook for the fail-open proof (same shape as OWNER_LOGIN_RATELIMIT_RPC).
    const rpc = process.env.CLAIM_START_RATELIMIT_RPC || "claim_start_rate_check";
    const call = Promise.resolve(
      supabaseAdmin.rpc(rpc, { p_email_hash: emailHash, p_ip_hash: ip ? sha256(ip) : null, p_will_send: willSend })
    );
    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("claim-start rate limiter timeout")), TIMEOUT_MS)),
    ]);
    if (res.error) return { verdict: "ok", error: res.error.message };
    if (res.data !== "ok" && res.data !== "ip_cap" && res.data !== "email_cap") {
      return { verdict: "ok", error: "claim-start rate limiter returned an unknown verdict" };
    }
    return { verdict: res.data };
  } catch (e) {
    return { verdict: "ok", error: e instanceof Error ? e.message : String(e) };
  }
}
