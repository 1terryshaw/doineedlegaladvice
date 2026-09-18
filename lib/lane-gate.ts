import { HAS_LIST_YOUR_BUSINESS } from "@/lib/add-business";

/**
 * THE SELF-SUBMITTED LANE'S GATE (newbiz-submissions-dinla-lane-spec-v1 §3.4, §4.2).
 *
 * ── DELIBERATELY NOT `server-only` ───────────────────────────────────────────────────
 * The seam gate and the Layer-1 harness must prove THE REAL GATE, not a copy of it. A
 * `server-only` import here would force the test to reimplement the decision, and a
 * reimplemented gate is the one thing a gate test must never assert against.
 *
 * ── THE DIRECTORY PLANE HAS NO `app_cohort_control` KILL SWITCH ──────────────────────
 * The register plane's lane is subordinate to a cohort-control row. DINLA has no such
 * table. The lane's gate is therefore `HAS_LIST_YOUR_BUSINESS` — the repo's OWN
 * route-presence flag, which already gates the two `/claim` and `/directory/[slug]`
 * affordances — plus `LANE_ROBOTS`. Reusing the existing flag rather than minting a new
 * env var is deliberate: a NEW env var can pass every local gate and be ABSENT from the
 * deploy target, where the code falls back to the default and withholds everything
 * silently (`feedback_env_parity_gate_missing_between_repo_and_deploy_target`). A
 * compiled-in constant cannot drift between the repo and Vercel, because there is
 * nothing in Vercel to drift from.
 */

/**
 * Is the lane's PUBLIC ENTRY switched on for this deployment?
 *
 * 🔴 THIS GATES THE FRONT DOOR, NOT THE WHOLE LANE. The routes exist and answer from the
 * moment they deploy (which is what §8.5 step 4 proves), and they 404 cleanly while the
 * relation is missing (§5.5). What the flag decides is whether the site ADVERTISES the
 * lane — the `/claim` Route 2 card and the `/directory/[slug]` footer link — and whether
 * the intake accepts a submission at all.
 */
export function laneOpen(): boolean {
  // ⚠️ `as boolean` WIDENS a literal-typed constant. `HAS_LIST_YOUR_BUSINESS` is declared
  // `= false`, so TypeScript gives it the literal type `false` and rejects `=== true` as a
  // comparison with no overlap. The fix belongs HERE, not in `lib/add-business.ts`: adding a
  // `: boolean` annotation there would stop the dead branch in `ClaimOrAddHub` being
  // narrowed away, which is a change to a file whose OFF state has to stay byte-identical to
  // the captured `/claim` golden (§4.2). The lane widens its own read instead.
  return HAS_LIST_YOUR_BUSINESS as boolean;
}

/**
 * The lane's robots directive — `noindex, follow` (§3.4).
 *
 * 🔴 ASSERTED BY IMPORTING THIS MODULE, NEVER BY A SOURCE REGEX. A regex over the source
 * passes on a comment that merely DESCRIBES the directive
 * (`feedback_substring_grep_for_directive_matches_its_own_comment`), and the value is the
 * thing that ships.
 *
 * DINLA has no `robotsFor`-style helper to mis-borrow — `app/robots.ts` is a blanket allow
 * with two sitemap refs and nothing else — so the hazard here is the opposite one: a lane
 * page that simply forgets to set `robots` inherits the site default and gets INDEXED.
 * PS-L5 asserts the value; the two render paths spread it into their `metadata`.
 *
 * `follow: true` keeps the owner funnel's own links navigable. `index: false` keeps the
 * lane out of the page set the sitemap advertises.
 */
export const LANE_ROBOTS: { readonly index: false; readonly follow: true } = {
  index: false,
  follow: true,
};

/**
 * The lane's chrome accent (§3.6).
 *
 * 🔴 DELIBERATELY NOT `verticalConfig.primaryColor` (#0f4c75) AND NOT THE CTA ORANGE
 * (#e07a00). Where the prose and the design disagree about whether a page is a directory
 * listing, the visitor believes the design — so a lane page must not be able to pass for a
 * `/directory/` page at a glance. A neutral slate, with an amber notice band carrying the
 * disclaimer.
 */
export const LANE_ACCENT = "#475569";
export const LANE_NOTICE_BG = "#fffbeb";
export const LANE_NOTICE_BORDER = "#b45309";

/** The lane's site key. Value-matches nothing; it is how an E2E row can never render on prod. */
export const LANE_SITE = "doineedlegaladvice";

/** Public origin, derived locally so no lane module has to import `lib/seo.ts` (PS-L5). */
export const LANE_BASE_URL = "https://doineedlegaladvice.com";

/** The lane's public page for a slug. One definition, so the three renders cannot drift. */
export function lanePublicUrl(slug: string): string {
  return `${LANE_BASE_URL}/listed/${slug}`;
}
