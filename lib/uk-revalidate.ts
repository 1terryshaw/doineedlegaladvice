// lib/uk-revalidate.ts — ON-DEMAND ISR PURGE FOR THE /uk SUBTREE (K32, 2026-08-24)
//
// WHY THIS EXISTS. The 2026-08-24 pilot put /uk/directory/[slug] and /uk on ISR with
// revalidate=86400. That is a 24h staleness window, and in this estate an unpublish is
// almost always a COMPLIANCE action (de-serve, LSNI/RCVS ruling, owner removal request).
// A de-published row whose cached HTML keeps serving 200 with the business name rendered
// is a compliance gap, not a cosmetic one — the is_published filter in getUkFirm() only
// runs on regeneration. This module is what makes the long interval safe: the purge, not
// the interval, is the freshness mechanism.
//
// SURGICAL, NOT SUBTREE-WIDE. We purge the affected LEAF plus its ANCESTOR HUBS only:
//
//   /uk/directory/{id}                  the leaf itself      -> 404 on next request
//   /uk/{county}/{town}                 town hub             (listed the row)
//   /uk/{county}                        county hub           (listed the row)
//   /uk                                 root hub             (county firm counts)
//
// revalidatePath("/uk", "layout") would purge the ENTIRE /uk subtree and re-render tens of
// thousands of leaves on the next crawl — destroying the exact cost win the ISR conversion
// bought. Every call here is a literal "page" purge.
//
// NOTE on the two middle paths: /uk/[county] and /uk/[county]/[town] are currently
// force-dynamic (they read ?category=), so purging them is a no-op TODAY. They are included
// deliberately — they are genuinely ancestors of the leaf, and the moment a vertical in the
// fan-out caches its hubs the purge set must already be correct. A no-op costs nothing; a
// missing ancestor is a silently stale hub.
//
// 🔴 PURGE_ROOT_HUB IS OFF IN THIS REPO — MEASURED, NOT ASSUMED.
// On this deployment (Next 14.2.35) `revalidatePath("/uk")` invalidates the ENTIRE /uk
// subtree, not just the /uk page. Measured on prod by cache-age continuity: two control
// leaves in unrelated counties (Greater London, Cumberland) both flipped HIT(age 33) ->
// REVALIDATED and reset to age 0 on a purge of an unrelated Derbyshire row — and again when
// purging a NONEXISTENT slug, whose only other path was "/uk". The identical test on
// doineedacleaningservice (Next 16.2.2) shows both controls surviving with age climbing
// straight through the purge (138->142->149), so the purge set is NOT the difference: the
// two Next majors are served by different Vercel ISR tag protocols, and the older one
// prefix-matches `_N_T_/uk`. (Both versions attach the SAME implicit tags to a page —
// verified in patch-fetch.js/implicit-tags.js — so this is a platform behaviour, not ours.)
//
// Dropping the root hub is the right trade here: /uk is a COUNTY INDEX. It renders zero
// firm names and zero /uk/directory/ links (verified on prod: 0 of each), so it is not a
// name-bearing compliance surface — only its per-county firm COUNTS go stale, for at most
// the 24h revalidate. Re-rendering ~17k leaves on every de-publish to keep a count exact is
// precisely the cost win the ISR conversion bought.
//
// FOR THE FAN-OUT: do not copy this flag on faith, measure it. Warm two leaves in unrelated
// counties, purge a third, and re-probe: if their `age` keeps climbing, the purge is
// surgical and this may be true; if they reset to 0, it must be false.
//
// SYMMETRIC BY CONSTRUCTION. Purging a path clears whatever is cached at it — a stale 200
// on unpublish, or a stale 404 on republish. There is no separate "publish" code path.

import { revalidatePath } from "next/cache";
import { getUkFirmGeoAnyState, ukSlugify } from "./uk-solicitors";

/** Per-request slug cap. Each slug fans out to up to 4 paths, so this is 4x heavier than a
 *  tag-based bust; callers with larger sets chunk. */
export const UK_REVALIDATE_MAX_SLUGS = 500;

/** Whether to include the "/uk" root hub in the purge set. FALSE here — on this repo's Next
 *  major, purging "/uk" cascades to the whole subtree. See the 🔴 note in the header block;
 *  it is a measured per-repo fact, not a preference. */
export const PURGE_ROOT_HUB = false;

/** Leaf slugs are the row UUID in this repo (cleaningservice uses company_number — the shape
 *  differs per vertical). Anything outside this shape is rejected rather than interpolated
 *  into a path — a slug containing "/" or ".." would otherwise let a caller aim the purge at
 *  an arbitrary route. */
const SLUG_RE = /^[A-Za-z0-9-]{1,64}$/;

export function isValidUkSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** The leaf + ancestor-hub paths for one /uk row, nearest-first. */
export async function ukPathsForSlug(slug: string): Promise<string[]> {
  const paths: string[] = [`/uk/directory/${slug}`];
  const geo = await getUkFirmGeoAnyState(slug);
  const countySlug = geo?.county ? ukSlugify(geo.county) : null;
  const townSlug = geo?.town ? ukSlugify(geo.town) : null;
  if (countySlug && townSlug) paths.push(`/uk/${countySlug}/${townSlug}`);
  if (countySlug) paths.push(`/uk/${countySlug}`);
  if (PURGE_ROOT_HUB) paths.push("/uk");
  return paths;
}

export interface UkRevalidateResult {
  paths: string[];
  errors: string[];
}

/**
 * Purge the leaf + ancestor hubs for each slug. Paths are de-duplicated across the batch,
 * so a 500-slug purge still touches each shared hub exactly once.
 *
 * A geo lookup that fails must NOT swallow the purge — the leaf is the compliance-critical
 * path, so on error we still purge the leaf and /uk and record the error.
 */
export async function revalidateUkSlugs(slugs: string[]): Promise<UkRevalidateResult> {
  const errors: string[] = [];
  const targets = new Set<string>();

  for (const slug of slugs) {
    if (!isValidUkSlug(slug)) {
      errors.push(`${slug}: invalid slug shape`);
      continue;
    }
    try {
      for (const p of await ukPathsForSlug(slug)) targets.add(p);
    } catch (e) {
      errors.push(`${slug}: geo lookup failed (${(e as Error)?.message || "unknown"})`);
      targets.add(`/uk/directory/${slug}`);
      if (PURGE_ROOT_HUB) targets.add("/uk");
    }
  }

  const purged: string[] = [];
  for (const path of Array.from(targets)) {
    try {
      // LITERAL path, NO `type` argument — this is the whole surgical-purge mechanism and it
      // is easy to get backwards. Verified against next/dist/.../revalidate.js + implicit-tags.js
      // rather than assumed:
      //   revalidatePath("/uk/directory/01012423")            -> tag `_N_T_/uk/directory/01012423`
      //   revalidatePath("/uk/directory/01012423", "page")    -> tag `_N_T_/…/01012423/page`  (matches NOTHING)
      //   revalidatePath("/uk", "layout")                     -> tag `_N_T_/uk/layout`        (purges the WHOLE subtree)
      // A rendered page carries its own literal pathname as a BARE implicit tag, while every
      // ancestor segment is carried `/layout`-suffixed. So a bare literal path hits exactly one
      // page, and `revalidatePath("/uk")` purges the /uk hub ONLY — leaves carry `_N_T_/uk/layout`,
      // not `_N_T_/uk`. The first cut of this passed "page" and silently purged nothing.
      revalidatePath(path);
      purged.push(path);
    } catch (e) {
      errors.push(`${path}: ${(e as Error)?.message || "unknown"}`);
    }
  }
  return { paths: purged, errors };
}
