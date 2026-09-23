export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";

// Admin-only on-demand cache-bust. Guarded by a dedicated REVALIDATE_SECRET
// Bearer token (fail-closed if unset) — NOT public.
//
// Purges all THREE expressions of a listing's cached identity:
//   1. revalidateTag(`listing:${slug}`)                  — the unstable_cache row tag
//      (inert in repos that have no unstable_cache producer; harmless, kept for parity)
//   2. revalidateTag(`enrichment:${VERTICAL}:${slug}`)   — lib/knowledge.ts fetch tag (24h)
//   3. revalidatePath(`/directory/${slug}`)              — the rendered ISR/static page itself
//
// (3) is the load-bearing one for ISR / no-TTL repos: a tag purge cannot evict a
// prerendered page that never read that tag. A LITERAL path with NO `type` argument
// is required — revalidatePath(path, "page") emits `_N_T_/<path>/page`, which matches
// nothing (K32). Do not add a type argument.
//
// CROSS-MAJOR: revalidateTag's signature differs by Next major — 14 takes (tag), 16 takes
// (tag, profile). Next 16 docs: when the purge comes from OUTSIDE a Server Action (a Route
// Handler / webhook, which is exactly this), pass `{ expire: 0 }` so stale content is NEVER
// served — the default `"max"` profile would keep a de-published, name-bearing page serving
// for up to a year. Next 14 ignores the extra argument at runtime; the cast keeps both
// majors type-clean (a bare 1-arg call is a hard TS2554 build failure on 16).
//
// Body: { slugs: string[], enrichmentSlugs?: string[] }
// `enrichmentSlugs` is optional and positionally paired with `slugs`; it exists only for
// repos whose enrichment sidecar is keyed on a DIFFERENT slug space than the route slug
// (ontarioforyou reads canadaforyou enrichment via listing.cfy_slug). Omit it everywhere else.
const purgeTag = revalidateTag as unknown as (tag: string, profile?: { expire: number }) => void;

const VERTICAL = "lawyer";
const MAX_SLUGS = 1000;

// Measured against every target vertical's live slug column on 2026-09-10, not assumed:
// `_` MUST be permitted — 494,873 of 513,962 legal_listings slugs carry a source-tag
// segment like `-tx_bar_2026_05_14-`, as do 4,691 trainer / 2,503 tireshop / 4,629 itsupport.
// A `^[A-Za-z0-9-]+$` regex would fail-closed on ~507k live rows. No `/`, `.`, space or
// `%` is accepted, so the value can never escape the `/directory/` segment.
const SLUG_RE = /^[A-Za-z0-9_-]{1,200}$/;

function authorized(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false; // fail closed
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { slugs?: unknown })?.slugs;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "slugs[] required" }, { status: 400 });
  }
  if (raw.length === 0) {
    return NextResponse.json({ error: "slugs[] must contain at least one non-empty string" }, { status: 400 });
  }
  if (raw.length > MAX_SLUGS) {
    return NextResponse.json({ error: `too many slugs (max ${MAX_SLUGS})` }, { status: 400 });
  }
  const invalid = raw.filter((s) => typeof s !== "string" || !SLUG_RE.test(s));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `invalid slug(s): ${invalid.slice(0, 5).map(String).join(", ")}${invalid.length > 5 ? ` (+${invalid.length - 5} more)` : ""}` },
      { status: 400 }
    );
  }
  const slugs = raw as string[];

  const rawEnrich = (body as { enrichmentSlugs?: unknown })?.enrichmentSlugs;
  let enrichmentSlugs: string[] = slugs;
  if (rawEnrich !== undefined) {
    if (!Array.isArray(rawEnrich) || rawEnrich.length !== slugs.length) {
      return NextResponse.json({ error: "enrichmentSlugs[] must be the same length as slugs[]" }, { status: 400 });
    }
    const badEnrich = rawEnrich.filter((s) => typeof s !== "string" || !SLUG_RE.test(s));
    if (badEnrich.length > 0) {
      return NextResponse.json({ error: `invalid enrichmentSlug(s): ${badEnrich.slice(0, 5).map(String).join(", ")}` }, { status: 400 });
    }
    enrichmentSlugs = rawEnrich as string[];
  }

  const errors: string[] = [];
  let revalidated = 0;
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    try {
      purgeTag(`listing:${slug}`, { expire: 0 });
      purgeTag(`enrichment:${VERTICAL}:${enrichmentSlugs[i]}`, { expire: 0 });
      revalidatePath(`/directory/${slug}`);
      revalidated++;
    } catch (e) {
      errors.push(`${slug}: ${(e as Error)?.message || "unknown"}`);
    }
  }

  // THE HOME PAGE. `/` became ISR in the #1244 fan (`export const revalidate = 3600`)
  // and this route did not purge it, so a claim or a publish left the most valuable
  // page on the site up to an HOUR stale with no way to evict it. Fired ONCE per
  // call, after the per-slug loop -- not once per slug.
  //
  // revalidatePath("/") and NOT a tag: this repo exports no HOME_LISTINGS_TAG. Its
  // home reads go through `supabaseCached`, whose fetches carry a revalidate but no
  // tag, so there is nothing for a tag purge to bind to and one stamped here "for
  // parity" would be a purge path that purges nothing.
  try {
    revalidatePath("/");
  } catch (e) {
    errors.push(`home: ${(e as Error)?.message || "unknown"}`);
  }

  return NextResponse.json({ revalidated, vertical: VERTICAL, errors });
}
