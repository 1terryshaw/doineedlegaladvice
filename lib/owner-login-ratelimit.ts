// owner-auth-ratelimit-and-hash-v1 — rate limiter for POST /api/owner/login ONLY.
// Deliberately NOT imported by any sender/helper: the route calls this BEFORE it reaches
// sendMagicLink, so outreach / lifecycle mail can never be throttled (or slowed) by it.
//
// Limits (enforced atomically in Postgres by owner_login_rate_check): 3 per email per hour,
// 10 per email per day, 20 per client IP per hour. Keys are plain sha256 of the normalized
// email / IP — raw values are never stored. FAIL-OPEN: any error (or a >1.5 s stall) returns
// { allowed: true, error } so an owner is never stranded; the route raises the sentinel alert.
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const TIMEOUT_MS = 1500;

/** First hop of x-forwarded-for (Vercel overwrites it with the real client IP), else x-real-ip. */
export function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : req.headers.get("x-real-ip") || "").trim();
  return ip || null;
}

export type OwnerLoginRateResult = { allowed: boolean; error?: string };

export async function checkOwnerLoginRate(email: unknown, req: NextRequest): Promise<OwnerLoginRateResult> {
  try {
    const emailHash = sha256(String(email).trim().toLowerCase());
    const ip = clientIp(req);
    const rpc = process.env.OWNER_LOGIN_RATELIMIT_RPC || "owner_login_rate_check";
    const call = Promise.resolve(
      supabaseAdmin.rpc(rpc, { p_email_hash: emailHash, p_ip_hash: ip ? sha256(ip) : null })
    );
    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("rate limiter timeout")), TIMEOUT_MS)),
    ]);
    if (res.error) return { allowed: true, error: res.error.message };
    if (typeof res.data !== "boolean") return { allowed: true, error: "rate limiter returned a non-boolean" };
    return { allowed: res.data };
  } catch (e) {
    return { allowed: true, error: e instanceof Error ? e.message : String(e) };
  }
}
