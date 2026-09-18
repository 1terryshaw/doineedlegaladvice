import { b32FromUuid } from "@/lib/lane-crypto";

/**
 * LANE SLUGS (spec §1.3).
 *
 * `slugify` is the fleet's, verbatim. What is bespoke here is the UNIQUENESS strategy:
 *
 * 🔴 THE SUFFIX IS DERIVED FROM THE ROW'S OWN UUID. THERE IS NO EXISTENCE PROBE, AND THERE
 * MUST NOT BE ONE.
 *
 * The obvious design — "check the candidate slug is free, suffix until it is" — needs a
 * query. Against the lane's own table that would be harmless; against `legal_listings`
 * (the "namespace it so it can't collide with the global slug unique index" instinct) it
 * would be a statement naming BOTH tables, which is precisely what PS-L4 forbids. And it
 * is not even needed: `fla_listings_slug_key` is `UNIQUE (slug)` ON `legal_listings`, and
 * a lane row is not in that table, so it cannot violate that index at all. The uniqueness
 * the lane needs is its own `UNIQUE (site, slug)`.
 *
 * So the suffix makes the slug unique WITHIN the lane with no query at all, and makes a
 * lane slug shaped unlike any directory slug into the bargain.
 */

/** Fleet-verbatim: lowercase → NFKD → strip diacritics → non-alphanumerics to `-` → trim → cap. */
export function slugify(value: string): string {
  return (
    (value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "business"
  );
}

/**
 * `{name}-{city}-{st}-{b32(uuid)[0..6]}` — the lane's slug.
 *
 * The region code is included because a bare name+city collides across states far more
 * often than it looks like it should, and because the shape then reads as a place rather
 * than as a credential.
 */
export function laneSlug(businessName: string, city: string, regionState: string, submissionId: string): string {
  const name = slugify(businessName);
  const place = slugify(city);
  const region = (regionState || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const suffix = b32FromUuid(submissionId).slice(0, 6);
  const base = [name, place === "business" ? "" : place, region]
    .filter((p) => p !== "")
    .join("-")
    .slice(0, 96)
    .replace(/-+$/g, "");
  return `${base}-${suffix}`;
}
