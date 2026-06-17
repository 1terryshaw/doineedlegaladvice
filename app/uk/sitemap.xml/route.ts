import verticalConfig from "@/lib/vertical.config";
import { getUkPublishedCount } from "@/lib/uk-solicitors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;

// UK sitemap-index. Chunk 0 = static + county + town-hub URLs (no firms). Chunks 1..N =
// firm URLs, CHUNK_SIZE each, so no child can exceed the 50k protocol limit. Mirrors the
// CA /sitemap.xml chunking but scoped to the published /uk/ universe.
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;

  const firmCount = await getUkPublishedCount();
  const totalChunks = 1 + Math.ceil(firmCount / CHUNK_SIZE);
  const lastmod = new Date().toISOString();

  const sitemaps = Array.from(
    { length: totalChunks },
    (_, i) =>
      `  <sitemap><loc>${baseUrl}/uk/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
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
