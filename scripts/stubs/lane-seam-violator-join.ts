/**
 * RED CONTROL for PS-L4. NOT SHIPPED, NOT IMPORTED BY ANYTHING.
 *
 * The one statement in this repo that names both tables. It lives in the fixtures directory,
 * which PS-L4 excludes from its scan — so the planted join can never fail the assertion it
 * exists to prove fires. Rename the report, never blunt the matcher.
 */
export const plantedJoin = `select s.slug, c.slug from legal_submitted_listing s join legal_listings c on c.slug = s.slug`;
