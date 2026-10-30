// Republish-on-claim for HELD (de-served) seeded rows — TDL #1068 pattern, ported to legal by
// tdl-1366-fleet-claim-republish-port-v1 (#1366, manager ruling 2026-10-30). Same module as
// doineedanaccountant / doineedabookkeeper (tdl-1353-k38-followup-v1) except VERTICAL_SLUG.
//
// THE GAP THIS CLOSES. claim/verify wrote claimed=true and never touched is_published, so a
// K38-held attorney row (deserve_reason='person_seeded_licensing_roster', ~495k US rows) was
// claimed by its subject and still served 410 — the subject consented and stayed dark.
//
// Called ONLY from POST /api/claim/verify, AFTER the owner token has been checked and the claim
// write has succeeded. The mailed link stays GET-safe (K245): GET never reaches this module.
//
// FAIL-CLOSED, in order:
//   1. Only a currently-held row (is_published === false) is considered; anything else is a no-op.
//   2. lib/republish-guard.ts (canonical, empire-policy) decides. ALLOW = person_seeded_licensing_
//      roster / nppes_type2_org_claim_then_publish ONLY. RESTRICTED, unmapped, NULL, nameless and
//      personal-email names stay held — a personal claim does not cure a SOURCE bar (C1–C5).
//   3. Every decision (ALLOW and DENY) is written to public.empire_republish_decisions. No audit
//      row, no flip: an unlogged compliance flip is unreconstructable.
//   4. The UPDATE re-asserts the held state in its WHERE (is_published=false AND an ALLOW reason),
//      so a row whose state moved between the read and the write is never published.
//      TDL #1047: a zero-row UPDATE returns no error — the count decides.
import { revalidateTag } from "next/cache";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import {
  REPUBLISH_ALLOW_REASONS,
  REPUBLISH_GUARD_VERSION,
  evaluateRepublish,
  type RepublishInput,
} from "@/lib/republish-guard";
import { nameEmailClassForRow } from "@/lib/name-email-guard";

const VERTICAL_SLUG = "lawyer"; // empire_verticals.vertical_slug for legal_listings

export type HeldClaimRow = {
  id: string | number;
  is_published?: boolean | null;
  deserve_reason?: string | null;
  name?: string | null;
  business_name?: string | null;
  submitted_via?: string | null;
};

export type RepublishOutcome = "not_held" | "republished" | "held";

export async function republishOnClaim(listing: HeldClaimRow, slug: string): Promise<RepublishOutcome> {
  if (listing.is_published !== false) return "not_held";

  const input: RepublishInput = {
    is_published: listing.is_published,
    deserve_reason: listing.deserve_reason,
    name: listing.name ?? listing.business_name ?? null,
    submitted_via: listing.submitted_via,
    name_email_class: await nameEmailClassForRow(supabaseAdmin, listing),
  };
  const decision = evaluateRepublish(input);

  const { error: auditErr } = await supabaseAdmin.from("empire_republish_decisions").insert({
    vertical_slug: VERTICAL_SLUG,
    listings_table: LISTINGS_TABLE,
    listing_id: String(listing.id),
    listing_slug: slug,
    deserve_reason: input.deserve_reason ?? null,
    name_present: /[A-Za-z]/.test(input.name ?? ""),
    is_published_before: input.is_published,
    verdict: decision.reason_code,
    allow: decision.allow,
    guard_version: REPUBLISH_GUARD_VERSION,
    actor: "claim_verify",
  });
  if (auditErr) {
    console.error(`[republish-on-claim] audit insert FAILED for ${slug}: ${auditErr.message} — row stays held`);
    return "held";
  }
  if (!decision.allow) return "held";

  const { error, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ is_published: true, deserve_reason: null, deserved_at: null }, { count: "exact" })
    .eq("id", listing.id)
    .eq("is_published", false)
    .in("deserve_reason", Array.from(REPUBLISH_ALLOW_REASONS));
  if (error || (count ?? 0) === 0) {
    console.error(`[republish-on-claim] flip failed for ${slug} (err=${error?.message ?? "0 rows"}) — row stays held`);
    return "held";
  }
  try { revalidateTag(`listing:${slug}`); } catch { /* best-effort; the leaf read is uncached */ }
  return "republished";
}
