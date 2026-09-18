import { evaluateRepublish } from "@/lib/republish-guard";

/**
 * THE HELD-AWARE FINDER'S DECISION (spec §2.3). THE BIGGEST DIVERGENCE IN THE BUILD.
 *
 * ── WHAT THIS IS, AND THE TWO THINGS IT IS NOT ──────────────────────────────────────
 * The retrieval half lives in SQL (`legal_lane_find_candidates`, migration
 * `2026-09-18_legal_lane_finder.sql`): lane-owned, STABLE, SECURITY INVOKER, SELECT-only,
 * `country='US'`, calling the database's OWN normalisers, `LIMIT 25`. The SCORING half is
 * here, in TypeScript, over the ≤25 rows it returns.
 *
 *  * IT IS NOT `dedup_match`. That function's candidate CTE is `where c.is_published is
 *    true` — the exact filter the lane must see past — and it is fail-closed on
 *    `match_claim_allowed_tables`, which `legal_listings` is not a member of and never will
 *    be. It cannot even be called against this table today, and the lane does not try.
 *
 *  * IT NEVER AUTO-MERGES. The recon measured 49 of 3,000 (1.63%) submissions that would T1
 *    `auto_claim` a DIFFERENT NAMED ATTORNEY's held row if held rows were made visible to a
 *    merging matcher. The finder is safe ONLY because its best outcome is a REDIRECT. It
 *    writes nothing, mints nothing and merges nothing, ever.
 *
 * ── THE DECISION IS DELIBERATELY COARSER THAN dedup_match's TIER LADDER ─────────────
 * The consequences are asymmetric: a false "you already have a record" costs a redirect; a
 * false "no match" costs a DUPLICATE IDENTITY on a legal-advice domain. So there is no
 * T1/T2/T3/T4 ladder here, and there is no auto-merge tier for one to lead to.
 *
 * Deliberately NOT `server-only` — the harness drives the real decision over fabricated
 * candidate sets, all four outcomes and both `matched_existing` sub-cases.
 */

/** One row as `legal_lane_find_candidates` returns it. */
export interface LaneCandidate {
  readonly cand_id: string;
  readonly cand_slug: string;
  readonly cand_name: string | null;
  readonly sim: number;
  readonly is_published: boolean | null;
  readonly deserve_reason: string | null;
  readonly phone_match: boolean;
  readonly domain_match: boolean;
  readonly zip_match: boolean;
  readonly snum_match: boolean;
}

export type LaneOutcome =
  | "matched_existing_served"
  | "matched_existing_held"
  | "matched_ambiguous"
  | "held_not_served"
  | "no_match";

export interface LaneRouting {
  readonly outcome: LaneOutcome;
  /** `/claim/<slug>` for 1 and 3, `/claim?...` for 2, null for `no_match`. */
  readonly claim_url: string | null;
  /** The candidate the copy is about. Never written anywhere; carried for the audit log only. */
  readonly best_slug: string | null;
  /** The guard's own code when one was consulted, "" otherwise. Copy selection ONLY. */
  readonly guard_reason_code: string;
  readonly confident: number;
  readonly weak: number;
}

/** A name-similarity floor. The SQL carries the same literal; it is never a GUC read. */
export const SIM_WEAK = 0.3;
export const SIM_STRONG = 0.85;

/** phone-exact ∨ domain-exact ∨ (zip ∩ sim ≥ 0.85). */
export function isConfident(c: LaneCandidate): boolean {
  return c.phone_match === true || c.domain_match === true || (c.zip_match === true && c.sim >= SIM_STRONG);
}

/** zip ∩ 0.3 ≤ sim < 0.85. */
export function isWeak(c: LaneCandidate): boolean {
  return !isConfident(c) && c.zip_match === true && c.sim >= SIM_WEAK && c.sim < SIM_STRONG;
}

/**
 * THE ROUTING TABLE, as one pure function. EVERY outcome writes NOTHING except `no_match`,
 * which is the only one that reaches the INSERT at all.
 *
 * 🔴 OUTCOME 3 IS DECIDED BY CALLING THE REPO'S OWN GUARD, NEVER A DUPLICATED STRING LIST,
 * AND IT IS READ FOR COPY SELECTION ONLY. `evaluateRepublish` is the canonical
 * `lib/republish-guard.ts` — byte-identical across the estate and drift-checked by
 * `empire-policy/sync_republish_guard.sh --verify`. The lane reads its verdict; it never
 * acts on it, and it never edits it.
 *
 * ⚠️ THE GUARD'S FIRST RULE IS `is_published !== false → DENY_not_down`, so a PUBLISHED
 * candidate always DENYs — for a reason that has nothing to do with a source restriction.
 * Routing a served match to `held_not_served` on that DENY would be exactly backwards, so
 * the guard is only consulted for a candidate that is actually HELD. This is the difference
 * between reading a verdict and pattern-matching on the word "DENY".
 */
export function routeCandidates(candidates: readonly LaneCandidate[], submittedName: string): LaneRouting {
  const confident = candidates.filter(isConfident);
  const weak = candidates.filter(isWeak);
  const counts = { confident: confident.length, weak: weak.length };

  if (confident.length === 0 && weak.length === 0) {
    return { outcome: "no_match", claim_url: null, best_slug: null, guard_reason_code: "", ...counts };
  }

  // `legal_lane_find_candidates` already returns ORDER BY sim DESC; re-sorting here means the
  // decision does not silently depend on the SQL's ordering surviving a future edit.
  const pool = confident.length > 0 ? confident : weak;
  const best = [...pool].sort((a, b) => b.sim - a.sim)[0]!;

  // Outcome 3 — the candidate is HELD and the guard DENYs it. The submitter is still handed
  // to `/claim/<slug>`: the honest copy already living at `app/claim/[slug]/page.tsx` is the
  // right thing for them to read, and the lane adds nothing and changes nothing there.
  if (best.is_published === false) {
    const verdict = evaluateRepublish({
      is_published: false,
      deserve_reason: best.deserve_reason,
      name: best.cand_name ?? submittedName,
    });
    if (!verdict.allow) {
      return {
        outcome: "held_not_served",
        claim_url: `/claim/${best.cand_slug}`,
        best_slug: best.cand_slug,
        guard_reason_code: verdict.reason_code,
        ...counts,
      };
    }
    // An ALLOW on a held row is outcome 1's HELD sub-case — and §0 is the reason that sub-case
    // needs its own copy. R-0 was ruled (a): THE HOLD STANDS. Claiming gives owner access and
    // removal; it does NOT publish. The lane says so, in its own surface, before the redirect.
    if (confident.length === 1 && weak.length === 0) {
      return {
        outcome: "matched_existing_held",
        claim_url: `/claim/${best.cand_slug}`,
        best_slug: best.cand_slug,
        guard_reason_code: verdict.reason_code,
        ...counts,
      };
    }
    return {
      outcome: "matched_ambiguous",
      claim_url: "/claim",
      best_slug: best.cand_slug,
      guard_reason_code: verdict.reason_code,
      ...counts,
    };
  }

  // Outcome 1, SERVED sub-case — exactly one confident candidate and no weak ones.
  if (confident.length === 1 && weak.length === 0) {
    return {
      outcome: "matched_existing_served",
      claim_url: `/claim/${best.cand_slug}`,
      best_slug: best.cand_slug,
      guard_reason_code: "",
      ...counts,
    };
  }

  // Outcome 2 — ≥2 confident, or 1+ weak. Hand off to the EXISTING claim finder's search.
  return {
    outcome: "matched_ambiguous",
    claim_url: "/claim",
    best_slug: best.cand_slug,
    guard_reason_code: "",
    ...counts,
  };
}

/**
 * THE HANDOFF COPY — R-0 ruling (a) wording, verbatim (spec §5.3).
 *
 * 🔴 `matched_existing_held` EXISTS BECAUSE OF §0. `POST /api/claim/verify` writes
 * `{claimed_at, claimed:true, updated_at}` and NEVER writes `is_published`; the #1068
 * republish flip has not landed in this repo and `/api/claim*` is OFF LIMITS (Terry
 * 2026-07-14). So a held attorney who claims gets OWNER ACCESS AND REMOVAL, not
 * publication — and for the ~87% of self-submitters the recon measured as having a held
 * twin, saying nothing about that would be a live, high-traffic broken promise.
 *
 * This string is served from THE LANE'S OWN SURFACE, before the redirect. The lane does not
 * edit `app/claim/[slug]/page.tsx`: that page is the claim path, and the lane does not edit
 * the claim path.
 */
export function handoffCopy(outcome: LaneOutcome): { heading: string; body: string; cta: string } {
  switch (outcome) {
    case "matched_existing_served":
      return {
        heading: "We already list this business",
        body:
          "You can claim it here — claiming verifies your email and gives you owner access to " +
          "update or remove the listing.",
        cta: "Claim this listing",
      };
    case "matched_existing_held":
      return {
        heading: "We already hold a record matching this business",
        body:
          "It is not published on the site. Claiming it verifies your email and gives you owner " +
          "access to update or remove the record — it does not publish the listing. Publication " +
          "of held records is on hold.",
        cta: "Claim this record",
      };
    case "held_not_served":
      return {
        heading: "We hold a record matching this business",
        body:
          "It is not published on the site and it will not be published. Opening it will explain " +
          "why, and lets you verify your email to get owner access or ask for the record to be " +
          "removed.",
        cta: "Open this record",
      };
    case "matched_ambiguous":
      return {
        heading: "Several listings look like this business",
        body: "Find yours and claim it.",
        cta: "Find your listing",
      };
    case "no_match":
      return { heading: "", body: "", cta: "" };
  }
}
