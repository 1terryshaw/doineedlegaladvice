// TDL #457: chunked sitemap-index. Replaces the flat app/sitemap.ts that
// select("*")'d ~194K rows and timed out. Children are served by
// app/sitemap/[id]/route.ts. CHUNK_SIZE / STATIC_PATH_COUNT / region-header
// count MUST stay in lockstep with that file so chunk math agrees.
//
// us+ca consolidation 2026-06-17: region headers = US active license_states
// (REGIONS-filtered) + CA active provinces (REGIONS-filtered); listing
// enumeration spans both countries via getListingsCount.
import verticalConfig from "@/lib/vertical.config";
import { REGIONS } from "@/lib/constants";
import { getActiveLicenseStates, getListingsCount, getListingsRange } from "@/lib/supabase";
import { getServedProvincesCA } from "@/lib/directory-hub";

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

const CHUNK_SIZE = 45_000;

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

const STATIC_PATH_COUNT = 7; // "", /directory, /pricing, /about, /contact, /terms, /privacy

async function renderSitemap() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;

  const [listingCount, activeStates, servedProvincesCA] = await Promise.all([
    getListingsCount(),
    getActiveLicenseStates(),
    getServedProvincesCA(),
  ]);

  // Region-page headers — MUST match app/sitemap/[id]/route.ts exactly. US
  // regions resolve via license_state→REGIONS; CA regions via a served-row
  // count under the serve predicate →REGIONS (TDL #322).
  const usRegions = REGIONS.filter((r) => activeStates.includes(r.province));
  const caRegions = REGIONS.filter((r) => servedProvincesCA.includes(r.province));

  // chunk 0 carries the static + region headers (one per active US state and CA
  // province). City pages are emitted in chunk 0 but, as before, are not
  // subtracted from listing capacity (chunk 0 stays within the 50K sitemap cap).
  const headers = STATIC_PATH_COUNT + usRegions.length + caRegions.length;
  const firstChunkListingCapacity = Math.max(0, CHUNK_SIZE - headers);
  const remainingListings = Math.max(0, listingCount - firstChunkListingCapacity);
  const remainingChunks = Math.ceil(remainingListings / CHUNK_SIZE);
  const totalChunks = 1 + remainingChunks;
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
    rows = await getListingsRange(0, listingCount);
  } catch (e) {
    console.error("sitemap index: lastmod scan failed; emitting children without <lastmod>", e);
  }
  const overall = latestOf(rows);
  const childLastmod = (i: number): string | undefined => {
    const start = i === 0 ? 0 : firstChunkListingCapacity + (i - 1) * CHUNK_SIZE;
    const end = i === 0 ? firstChunkListingCapacity : start + CHUNK_SIZE;
    return latestOf(rows.slice(start, end)) ?? overall;
  };

  const sitemaps = Array.from({ length: totalChunks }, (_, i) =>
    `  <sitemap><loc>${baseUrl}/sitemap/${i}.xml</loc>${lastmodTag(childLastmod(i))}</sitemap>`
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

// A generation fault LOGS AND RETHROWS (see the ISR note at the top of this file). Under ISR that
// keeps the last good copy serving; the old 503 fallback replaced a correct sitemap with an error
// page, and Search Console reads a 503 on a submitted sitemap as "couldn't fetch". At build time
// the same throw fails the build. An empty/partial 200 stays impossible — the data helpers throw
// rather than returning a short result, which is the P1 2026-07-13 discipline, unchanged.
export async function GET(
  ...args: Parameters<typeof renderSitemap>
): Promise<Response> {
  try {
    return await renderSitemap(...args);
  } catch (err) {
    console.error("[sitemap] generation FAULT — rethrowing so ISR keeps the last good copy:", err);
    throw err;
  }
}
