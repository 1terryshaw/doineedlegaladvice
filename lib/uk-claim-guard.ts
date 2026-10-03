// d8-uk-claim-route-hardening-v1 — the UK claim/verify contract. Byte-identical on the 9 UK repos;
// the only per-repo input is the UK_TABLE the routes pass in.
//
// 1. An UNVERIFIED claim lives in uk_claim_pending (sha256 of the token + claimant email/name), never
//    on the listing row. owner_auth_token / owner_email / owner_name reach the row ONLY inside
//    uk_claim_verify(), in the same statement that flips is_claimed.
// 2. Verify is idempotent: re-using the link that verified the row returns "already_verified" and the
//    DB function writes nothing (claimed_at is no longer rewritten on every click).
// 3. POST /api/uk/claim is rate limited by uk_claim_rate_check — the owner-login limiter's shape
//    (3/email/h, 10/email/day, 20/IP/h, sha256 keys) on its own table, so claim traffic never spends
//    the owner-login budget. FAIL-OPEN: any limiter error lets the claim through; the caller raises
//    the sentinel alert.
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientIp } from "@/lib/owner-login-ratelimit";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const RATE_TIMEOUT_MS = 1500;

export type UkClaimRateResult = { allowed: boolean; error?: string };

export async function checkUkClaimRate(email: unknown, req: NextRequest): Promise<UkClaimRateResult> {
  try {
    const emailHash = sha256(String(email).trim().toLowerCase());
    const ip = clientIp(req);
    const call = Promise.resolve(
      supabaseAdmin.rpc("uk_claim_rate_check", { p_email_hash: emailHash, p_ip_hash: ip ? sha256(ip) : null })
    );
    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("rate limiter timeout")), RATE_TIMEOUT_MS)),
    ]);
    if (res.error) return { allowed: true, error: res.error.message };
    if (typeof res.data !== "boolean") return { allowed: true, error: "rate limiter returned a non-boolean" };
    return { allowed: res.data };
  } catch (e) {
    return { allowed: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Persist an unverified claim. Returns the pending row id (for cleanup if the send fails). */
export async function createUkPendingClaim(
  table: string,
  listingId: string,
  token: string,
  email: string,
  name: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("uk_claim_pending")
    .insert({
      listing_table: table,
      listing_id: listingId,
      token_sha256: sha256(token),
      owner_email: email,
      owner_name: name,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "no row returned" };
  return { ok: true, id: String(data.id) };
}

/** Best-effort removal of a pending claim whose verification email never went out. */
export async function deleteUkPendingClaim(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("uk_claim_pending").delete().eq("id", id);
  if (error) console.error(`[uk-claim] pending cleanup failed: ${error.message}`);
}

export type UkClaimVerifyStatus = "verified" | "verified_legacy" | "already_verified" | "invalid" | "error";

export async function verifyUkClaim(table: string, listingId: string, token: string): Promise<UkClaimVerifyStatus> {
  const { data, error } = await supabaseAdmin.rpc("uk_claim_verify", {
    p_table: table,
    p_listing_id: listingId,
    p_token: token,
  });
  if (error) {
    console.error(`[uk/claim/verify] uk_claim_verify failed: ${error.message}`);
    return "error";
  }
  if (data === "verified" || data === "verified_legacy" || data === "already_verified" || data === "invalid") {
    return data;
  }
  console.error(`[uk/claim/verify] uk_claim_verify returned an unknown status: ${String(data)}`);
  return "error";
}
