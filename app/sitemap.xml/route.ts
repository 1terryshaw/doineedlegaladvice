// TDL #457: chunked sitemap-index. Replaces the flat app/sitemap.ts that
// select("*")'d ~194K rows and timed out. Children are served by
// app/sitemap/[id]/route.ts. CHUNK_SIZE / STATIC_ENTRIES / active-state
// region count MUST stay in lockstep with that file so chunk math agrees.
import verticalConfig from "@/lib/vertical.config";
import { getListingsCount, getActiveLicenseStates } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;
const STATIC_PATH_COUNT = 7; // "", /directory, /pricing, /about, /contact, /terms, /privacy

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;

  const [listingCount, activeStates] = await Promise.all([
    getListingsCount(),
    getActiveLicenseStates(),
  ]);

  // chunk 0 carries the static + region (one per active license_state) headers.
  const headers = STATIC_PATH_COUNT + activeStates.length;
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
