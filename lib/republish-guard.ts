// ============================================================================
// CANONICAL campaign-wide republish-on-claim guard.
// Crawl-budget / K38 compliance arc, ruling 2026-07-18.
// NPPES Type 2 organization claim-then-publish authority, ruling 2026-07-22.
//
// THIS FILE IS THE SINGLE SOURCE OF TRUTH. Do NOT edit per-repo copies.
// Each repo carries a byte-identical copy at `lib/republish-guard.ts`.
// Sync + drift-detection: empire-policy/sync_republish_guard.sh
//   - `sync_republish_guard.sh --write <repoDir>`  copies this file into the repo
//   - `sync_republish_guard.sh --verify`           md5-compares every copy; nonzero exit on drift
// Shared test vectors: empire-policy/republish_guard.testvectors.json
//   (one case per decision-table row; every repo's guard MUST pass them).
//
// DECISION TABLE (FIXED by ruling — fail-closed; do not expand without a code change here):
//   person_seeded_licensing_roster     -> ALLOW  (K38: an email-verified claim is the
//                                                 subject's consent; ruling 2026-07-18)
//   nppes_type2_org_claim_then_publish -> ALLOW  (organization lane; ruling 2026-07-22 — and
//                                                 ONLY if the org-lane preconditions hold)
//   RESTRICTED_SOURCE_TERMS            -> DENY   (source-licence origin, not K38; #1014 held)
//   every other deserve_reason         -> DENY
//   null / missing / unrecognised      -> DENY
//
// Note: this is STRICTER than doineedanotary's original lib/republish-guard.ts, which also
// allowed PERSON_SEEDED_LIABILITY and cross_vertical_person_survivor. Under this ruling those
// DENY. notary must be re-synced to this canonical (tracked as a follow-on port).
//
// ---------------------------------------------------------------------------
// THE TWO ALLOW REASONS ARE SEPARATE AUTHORITY CLASSES. Never conflate them.
//
//   person_seeded_licensing_roster      person-grain. A natural person seeded from a
//                                       licensing roster. A verified claim is the SUBJECT'S
//                                       CONSENT to be named. K38.
//
//   nppes_type2_org_claim_then_publish  ORGANIZATION-grain. An active NPPES Type 2
//                                       organization seeded truthfully as a non-public,
//                                       claimable ORGANIZATION record. A verified claim is
//                                       an AUTHORIZED OWNER asserting control of the entity.
//                                       NOT consent-to-be-named, and NOT a person.
//
// They must remain separately identifiable so that either authority can be reverted or
// disabled WITHOUT touching the other (CLAUDE.md C4). That is why evaluateRepublish returns
// a reason-specific ALLOW code and an `authority` field rather than one generic "allowed" —
// callers, revert predicates and reporting all key off the specific authority.
// ============================================================================

export const REPUBLISH_GUARD_VERSION = "1.1.0";

export const REASON_PERSON_SEEDED_LICENSING_ROSTER = "person_seeded_licensing_roster";
export const REASON_NPPES_TYPE2_ORG_CTP = "nppes_type2_org_claim_then_publish";

// The ONLY deserve_reasons a claim may cure. Adding a value here is the deliberate,
// auditable code change the ruling requires — there is no data-driven allow path.
// NOTE: these sets use STRING LITERALS, not the REASON_* constants, deliberately.
// sync_republish_guard.sh --verify extracts them with awk+grep from the file text to
// drift-check the empire-outreach invite copy across a repo boundary that has no shared
// module graph. Constants here would extract as identifier names and silently break it.
// republish_guard.test.ts asserts the constants and the set members stay in agreement.
export const REPUBLISH_ALLOW_REASONS: ReadonlySet<string> = new Set<string>([
  "person_seeded_licensing_roster",
  "nppes_type2_org_claim_then_publish",
]);

/**
 * Reasons whose rows may be INVITED to claim by empire-outreach.
 *
 * This is deliberately a SUBSET of REPUBLISH_ALLOW_REASONS, not a mirror of it. The two
 * answer different questions:
 *   REPUBLISH_ALLOW_REASONS  — "if this row is validly claimed, may it publish?"
 *   REPUBLISH_INVITE_REASONS — "may we email this row's subject asking them to claim?"
 *
 * Inviting a reason the guard DENIES is a promise the guard cannot keep — that is the drift
 * that caused the original silent-DENY incident, and it stays forbidden. But the converse is
 * NOT automatic: making a new authority publishable on claim does NOT decide that we should
 * start emailing that population. Outreach audience is its own decision with its own owner.
 *
 * nppes_type2_org_claim_then_publish is therefore ALLOW-but-NOT-INVITE: the 2026-07-22 ruling
 * authorised publication-on-claim for organizations and explicitly did not change outreach.
 * Moving a reason into this set is a separate, deliberate outreach decision.
 */
export const REPUBLISH_INVITE_REASONS: ReadonlySet<string> = new Set<string>([
  "person_seeded_licensing_roster",
]);

export type RepublishInput = {
  is_published: boolean | null;
  // `undefined` models a row from a table WITHOUT a deserve_reason column -> DENY (fail-closed).
  deserve_reason?: string | null;
  name: string | null;
  // --- org-lane fields. Only consulted for REASON_NPPES_TYPE2_ORG_CTP. -------------
  // `undefined` models a table without the column. For the org lane that is a DENY
  // (fail-closed); for the person lane these are ignored entirely, so the repos that never
  // carry the org reason are behaviourally unchanged whether or not they select them.
  npi?: string | null;
  submitted_via?: string | null;
};

export type RepublishReasonCode =
  | "ALLOW_person_seeded_licensing_roster"
  | "ALLOW_nppes_type2_org_claim_then_publish"
  | "DENY_not_down"                 // already published — nothing to republish
  | "DENY_nameless"                 // guard d: a nameless row must never render
  | "DENY_missing_reason"           // null / undefined (missing column)
  | "DENY_restricted_or_unmapped"   // any other value — RESTRICTED_*, unrecognised, etc.
  | "DENY_org_lane_missing_npi"     // org lane: no organization identity on the row
  | "DENY_org_lane_untruthful_provenance"; // org lane: not submitted_via='seeded'

export type RepublishDecision = {
  allow: boolean;
  reason_code: RepublishReasonCode;
  /** The specific authority relied on, for revert predicates and per-authority reporting. */
  authority?: string;
};

/**
 * Evaluate whether an email-verified claim may republish (flip is_published=true) this row.
 * FAIL-CLOSED: any reason the guard has never seen — or a missing/NULL reason — DENIES.
 *
 * SCOPE NOTE for the org lane. This function is a pure, row-local decision. The ruling's
 * wider preconditions — active NPI, no replacement-NPI conflict, no unresolved duplicate,
 * correct vertical, organization grain under the canonical classifier — are SEED-TIME
 * properties, enforced by the brownfield-first resolver that assigns the reason in the first
 * place. A row only ever carries nppes_type2_org_claim_then_publish because it passed them.
 * What this guard re-checks at claim time is what is knowable from the row itself: that an
 * organization identity (npi) is still present, and that provenance is still the truthful
 * seeded provenance the ruling requires (never self_serve).
 */
export function evaluateRepublish(l: RepublishInput): RepublishDecision {
  // guard a — only a currently-down row can be republished
  if (l.is_published !== false) return { allow: false, reason_code: "DENY_not_down" };
  // guard d — never publish a nameless row
  if (!/[A-Za-z]/.test(l.name ?? "")) return { allow: false, reason_code: "DENY_nameless" };
  // fail-closed on missing / NULL reason (undefined = column absent)
  if (l.deserve_reason === null || l.deserve_reason === undefined)
    return { allow: false, reason_code: "DENY_missing_reason" };
  // fail-closed on any reason not explicitly allowed
  if (!REPUBLISH_ALLOW_REASONS.has(l.deserve_reason))
    return { allow: false, reason_code: "DENY_restricted_or_unmapped" };

  if (l.deserve_reason === REASON_NPPES_TYPE2_ORG_CTP) {
    // Organization identity must still be present on the row.
    if (typeof l.npi !== "string" || l.npi.trim() === "")
      return { allow: false, reason_code: "DENY_org_lane_missing_npi" };
    // Truthful provenance: the ruling forbids this lane impersonating self-serve.
    if (l.submitted_via !== "seeded")
      return { allow: false, reason_code: "DENY_org_lane_untruthful_provenance" };
    return {
      allow: true,
      reason_code: "ALLOW_nppes_type2_org_claim_then_publish",
      authority: REASON_NPPES_TYPE2_ORG_CTP,
    };
  }

  return {
    allow: true,
    reason_code: "ALLOW_person_seeded_licensing_roster",
    authority: REASON_PERSON_SEEDED_LICENSING_ROSTER,
  };
}

/** Boolean convenience mirroring the legacy notary signature. */
export function canRepublishOnClaim(l: RepublishInput): boolean {
  return evaluateRepublish(l).allow;
}
