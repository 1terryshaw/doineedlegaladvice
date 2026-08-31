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
import {
  getListingsCount,
  getActiveLicenseStates,
} from "@/lib/supabase";
import { getServedProvincesCA } from "@/lib/directory-hub";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;
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

  const sitemaps = Array.from({ length: totalChunks }, (_, i) =>
    `  <sitemap><loc>${baseUrl}/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

// FAIL-CLOSED SITEMAP (P1 2026-07-13) ------------------------------------------------
// A sitemap must NEVER serve a partial or empty result at HTTP 200. A well-formed
// but EMPTY <urlset> at 200 tells Google "this chunk has no URLs" and de-indexes it;
// a 5xx tells Google "temporary" so it retries and KEEPS the previous sitemap.
// Every data helper below throws on error (see lib/supabase.ts); this boundary turns
// any such throw into a real 503 instead of a silently-degraded 200.
export async function GET(
  ...args: Parameters<typeof renderSitemap>
): Promise<Response> {
  try {
    return await renderSitemap(...args);
  } catch (err) {
    console.error("[sitemap] FAIL-CLOSED 503 — refusing to serve a partial/empty sitemap:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap temporarily unavailable; retry -->`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "no-store",
          "Retry-After": "600",
        },
      }
    );
  }
}
