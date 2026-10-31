// TDL #1372 containment (tdl-1372-held-claim-containment-v1, COO Action 4, manager ruling 2026-10-30).
//
// A verified claim proves only that the claimant controls the email address they typed. That is NOT identity
// proof for a K38-held natural person, so it no longer authorizes the publication transition. A verified claim
// on a row held under a republish ALLOW reason (lib/republish-guard.ts REPUBLISH_ALLOW_REASONS) is recorded —
// the claim write stands — and queued as claim state `pending_identity`; the row stays held (410 + noindex, out of
// sitemap/search). The claimant is sent to /claim/received ("we'll confirm before your listing goes live") with no
// owner session. RESTRICTED rows stay dark as before; published (non-held) rows claim exactly as before.
//
// The identity-proof policy is NOT decided here (COO/privacy ruling owed; fix ownership #1314/#1372). Only an
// `identity_approved` queue row lets the DB backstop (trg_k38_held_publish_identity_guard) pass a publish.
//
// FAIL-CLOSED: this module never publishes. An audit or queue write failure is logged and the row stays held.
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { REPUBLISH_ALLOW_REASONS, REPUBLISH_GUARD_VERSION } from "@/lib/republish-guard";
import { clientIp } from "@/lib/owner-login-ratelimit";

export function isK38Held(row: { is_published?: boolean | null; deserve_reason?: string | null }): boolean {
  return row.is_published === false && !!row.deserve_reason && REPUBLISH_ALLOW_REASONS.has(row.deserve_reason);
}

export async function recordPendingIdentity(p: {
  verticalSlug: string;
  id: string | number;
  slug: string;
  deserveReason: string | null | undefined;
  name: string | null | undefined;
  ownerEmail: string | null | undefined;
}): Promise<void> {
  const { error: auditErr } = await supabaseAdmin.from("empire_republish_decisions").insert({
    vertical_slug: p.verticalSlug,
    listings_table: LISTINGS_TABLE,
    listing_id: String(p.id),
    listing_slug: p.slug,
    deserve_reason: p.deserveReason ?? null,
    name_present: /[A-Za-z]/.test(p.name ?? ""),
    is_published_before: false,
    verdict: "PENDING_identity",
    allow: false,
    guard_version: REPUBLISH_GUARD_VERSION,
    actor: "claim_verify",
  });
  if (auditErr) console.error(`[held-claim-identity] audit insert FAILED for ${p.slug}: ${auditErr.message} — row stays held`);

  const email = (p.ownerEmail ?? "").trim().toLowerCase();
  const { error: queueErr } = await supabaseAdmin.from("empire_claim_identity_queue").upsert(
    {
      listings_table: LISTINGS_TABLE,
      listing_id: String(p.id),
      listing_slug: p.slug,
      vertical_slug: p.verticalSlug,
      deserve_reason: p.deserveReason ?? null,
      state: "pending_identity",
      source: "claim_verify",
      claimant_email_sha256: email ? createHash("sha256").update(email).digest("hex") : null,
    },
    { onConflict: "listings_table,listing_id,claimant_email_sha256", ignoreDuplicates: true },
  );
  if (queueErr) console.error(`[held-claim-identity] queue write FAILED for ${p.slug}: ${queueErr.message} — row stays held`);
}

export function claimReceivedUrl(siteUrl: string, slug: string): string {
  return `${siteUrl}/claim/received?slug=${encodeURIComponent(slug)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TDL #1314/#1372 — stream10-held-identity-safety-v1 (2026-10-31, COO safety ruling).
//
// A K38-held row is NEVER claimed on the listing row: no claimed flag, no owner_auth_token, so no owner session, no
// owner login and no "already claimed" lockout of the real licensee. Each claimant is a CANDIDATE row in
// empire_claim_identity_queue (many per listing), written only through the DB functions below. The DB enforces the
// same thing for every writer (trg_k38_held_capability_guard), so app and DB agree.
//
// FAIL CLOSED: a gate/limiter/RPC error or timeout DENIES. Nothing here can approve identity or publish.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
const HELD_RPC_TIMEOUT_MS = 5000;

async function heldRpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await Promise.race([
      Promise.resolve(supabaseAdmin.rpc(fn, args)),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${fn} timeout`)), HELD_RPC_TIMEOUT_MS)),
    ]);
    if (res.error) return { data: null, error: res.error.message };
    return { data: res.data as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

const HELD_UNAVAILABLE = "Claiming this listing is temporarily unavailable. Please try again in a few minutes.";

export type HeldClaimStart =
  | { action: "send"; token: string }
  | { action: "silent" }
  | { action: "deny"; status: number; error: string; userMessage: string; reason?: string };

/** Claim START on a K38-held row: abuse gate (fail closed) + DB candidate/rate RPC (fail closed). Never writes the listing. */
export async function heldClaimStart(p: {
  listingId: string | number;
  listingName: string | null | undefined;
  email: string;
  name: string;
  request: NextRequest;
  verticalSlug: string;
}): Promise<HeldClaimStart> {
  // Fault-injection hooks (same shape as CLAIM_START_RATELIMIT_RPC) for the fail-closed proofs.
  const gate = await heldRpc<{ blocked?: boolean; reason?: string } | null>(process.env.HELD_ABUSE_RPC || "abuse_claim_verdict", {
    p_email: p.email,
    p_listing_id: String(p.listingId),
    p_listing_name: p.listingName ?? "",
  });
  if (gate.error) {
    console.error(`[held-claim] abuse gate FAILED CLOSED: ${gate.error}`);
    return { action: "deny", status: 503, error: "temporarily_unavailable", userMessage: HELD_UNAVAILABLE };
  }
  if (gate.data && gate.data.blocked) {
    const reason = gate.data.reason;
    const userMessage =
      reason === "cooling_off_72h"
        ? "You recently contacted this listing. For security, claiming is paused for 72 hours after an inquiry. Please try again later, or contact support."
        : "This claim can't be completed automatically. Please contact support.";
    return { action: "deny", status: 403, error: "claim_blocked", userMessage, reason };
  }
  const started = await heldRpc<{ status?: string; token?: string }>(process.env.HELD_CLAIM_START_RPC || "empire_k38_claim_start", {
    p_table: LISTINGS_TABLE,
    p_listing_id: String(p.listingId),
    p_email: p.email,
    p_name: p.name,
    p_ip: clientIp(p.request) ?? "",
    p_vertical: p.verticalSlug,
  });
  const status = started.data?.status;
  if (started.error || !status) {
    console.error(`[held-claim] claim start FAILED CLOSED: ${started.error ?? "no status"}`);
    return { action: "deny", status: 503, error: "temporarily_unavailable", userMessage: HELD_UNAVAILABLE };
  }
  if (status === "issued" && started.data?.token) return { action: "send", token: started.data.token };
  if (status === "throttled" || status === "closed") {
    console.log(JSON.stringify({ event: "held_claim_start_silent", reason: status }));
    return { action: "silent" };
  }
  if (status === "invalid_email") {
    return { action: "deny", status: 400, error: "invalid_email", userMessage: "Please enter a valid email address." };
  }
  if (status === "not_found") {
    return { action: "deny", status: 404, error: "not_found", userMessage: "We couldn't find that listing." };
  }
  return { action: "deny", status: 503, error: "temporarily_unavailable", userMessage: HELD_UNAVAILABLE };
}

/** Verify POST on a K38-held row: candidate -> pending_identity. "received" or "error" (any failure = error). */
export async function heldClaimVerify(listingId: string | number, token: string): Promise<"received" | "error"> {
  const res = await heldRpc<{ status?: string }>("empire_k38_claim_verify", {
    p_table: LISTINGS_TABLE,
    p_listing_id: String(listingId),
    p_token: token,
  });
  const status = res.data?.status;
  if (res.error) console.error(`[held-claim] verify FAILED CLOSED: ${res.error}`);
  return status === "pending_identity" || status === "already_pending" ? "received" : "error";
}

/** Read-only token check for the /claim/verify interstitial. Any failure = false. */
export async function heldClaimPeek(listingId: string | number, token: string): Promise<boolean> {
  const res = await heldRpc<boolean>("empire_k38_claim_peek", {
    p_table: LISTINGS_TABLE,
    p_listing_id: String(listingId),
    p_token: token,
  });
  return res.data === true;
}
