import { SITE_URL } from "@/lib/seo";
import { getUkFirmsRange, getUkPublishedCount } from "@/lib/uk-solicitors";

/**
 * ── 🔴 ISR, AND NO 503 FALLBACK (2026-09-14, sitemap-cdn-sweep-v1; ref doineedamechanic 4aaddf8) ──
 * Prerendered and revalidated every 24h rather than rebuilt per request. This route was
 * `force-dynamic` + `revalidate = 0` + an explicit `max-age=0` header, so it was never cached at
 * all: `x-vercel-cache: MISS` on every fetch, including back-to-back ones, and every crawler hit
 * spent a function invocation on a full listings scan. The file changes at most once a day.
 *
 * The handler reads NOTHING from the request — no headers, no cookies, no searchParams; a chunk id
 * comes from the PATH PARAM only — which is what makes `force-static` legal here.
 *
 * `fetchCache = "force-no-store"` is GONE, and the sitemap data helpers moved to `supabaseRead`:
 * an explicit no-store fetch forces the whole route dynamic, so leaving either in place would have
 * made `force-static` a silent no-op. Unqualified fetches inherit the segment's `revalidate`, so
 * the inner reads refresh on the same 24h window as the route.
 *
 * A generation FAULT now LOGS AND RETHROWS instead of returning 503. Under ISR a throw leaves the
 * last good copy in place; the 503 replaced a correct sitemap with an error page for as long as
 * the fault lasted, and Search Console reads a 503 on a submitted sitemap as "couldn't fetch" — a
 * day of lost recrawl for what may be one bad connection. At BUILD time the same throw fails the
 * build, so a broken deployment never replaces a working one. A degraded 200 remains impossible:
 * the helpers still throw rather than return a partial result (P1 2026-07-13 preserved, only its
 * failure MODE changed).
 */
export const dynamic = "force-static";
export const revalidate = 86400;
export const maxDuration = 60;

// ── CHILD SPLIT (2026-09-14, sitemap-cdn-sweep-v1; ref doineedachiropractor 02e70d1 / doineedamechanic 4aaddf8) ──
// 45,000 → 5,000 URLs per child (~1.1 MB). This tree was shipping a child of 3.2 MB, and Google
// had registered none of it. MUST equal the sibling route's CHILD_SIZE: the index SIZES the
// children from it, so a disagreement slides every offset. `/sitemap/0.xml` stays the first child
// so nothing Google already queued 404s.
const CHILD_SIZE = 5_000;

/** ISO timestamp of the newest `updated_at` (else `created_at`) in a set of rows; undefined if none is dated. Never fabricated. */
function latestOf(rows: readonly { updated_at?: string | null; created_at?: string | null }[]): string | undefined {
  let latest: string | undefined;
  for (const r of rows) {
    const raw = r.updated_at || r.created_at;
    if (!raw) continue;
    const iso = new Date(raw).toISOString();
    if (latest === undefined || iso > latest) latest = iso;
  }
  return latest;
}
const lastmodTag = (d: string | undefined): string => (d ? `<lastmod>${d}</lastmod>` : "");


// UK sitemap-index. Chunk 0 = static + county + town-hub URLs (no firms). Chunks 1..N =
// firm URLs, CHILD_SIZE each, so no child can exceed the 50k protocol limit. Mirrors the
// CA /sitemap.xml chunking but scoped to the published /uk/ universe.
export async function GET() {
  // Canonical host from SITE_URL (lib/seo.ts) — the SAME source the pages'
  // <link rel="canonical"> uses. NOT NEXT_PUBLIC_BASE_URL: on prod that env var can hold
  // the APEX form, which would make every sitemap URL a 308 redirect to the www canonical.
  const baseUrl = SITE_URL;

  const firmCount = await getUkPublishedCount();
  const totalChunks = 1 + Math.ceil(firmCount / CHILD_SIZE);
  const lastmod = new Date().toISOString();

  // Per-child <lastmod> = MAX(updated_at, else created_at) of the rows IN that child, read through
  // the SAME ordered range reader and predicates the child route uses, so the date is a property of
  // the rows and is stable across regenerations. Never `new Date()`: a lastmod that moved on every
  // regeneration told Google every child changed every day — indistinguishable from no lastmod.
  // The scan is DECORATIVE to the index's correctness (the child list is sized from the count
  // above). If it fails — e.g. PostgREST's 8 s statement timeout under contention — the index still
  // emits every child, just without <lastmod>; the next regeneration restores it.
  let rows: { updated_at?: string | null; created_at?: string | null }[] = [];
  try {
    rows = await getUkFirmsRange(0, firmCount);
  } catch (e) {
    console.error("sitemap index: lastmod scan failed; emitting children without <lastmod>", e);
  }
  const overall = latestOf(rows);
  const childLastmod = (i: number): string | undefined =>
    i === 0 ? overall : latestOf(rows.slice((i - 1) * CHILD_SIZE, i * CHILD_SIZE)) ?? overall;

  const sitemaps = Array.from(
    { length: totalChunks },
    (_, i) =>
      `  <sitemap><loc>${baseUrl}/uk/sitemap/${i}.xml</loc>${lastmodTag(childLastmod(i))}</sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      // No explicit Cache-Control (K257): with `revalidate = 86400` Next emits
      // `s-maxage=86400, stale-while-revalidate` itself. The old
      // `public, max-age=0, must-revalidate` OVERRODE that and left the CDN with
      // nothing to hold — x-vercel-cache: MISS on every fetch.
    },
  });
}
