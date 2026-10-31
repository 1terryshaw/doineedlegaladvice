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
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { REPUBLISH_ALLOW_REASONS, REPUBLISH_GUARD_VERSION } from "@/lib/republish-guard";

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
    { onConflict: "listings_table,listing_id", ignoreDuplicates: true },
  );
  if (queueErr) console.error(`[held-claim-identity] queue write FAILED for ${p.slug}: ${queueErr.message} — row stays held`);
}

export function claimReceivedUrl(siteUrl: string, slug: string): string {
  return `${siteUrl}/claim/received?slug=${encodeURIComponent(slug)}`;
}
