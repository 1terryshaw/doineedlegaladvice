// TDL #457: sitemap chunk children. Served as /sitemap/{id}.xml; the index is
// app/sitemap.xml/route.ts. chunk 0 carries static + state-page headers; every
// chunk carries a CHUNK_SIZE-bounded slice of listing URLs via the minimal-
// projection getListingsRange (no select("*") → no route timeout).
import verticalConfig from "@/lib/vertical.config";
import { REGIONS } from "@/lib/constants";
import {
  getListingsRange,
  getActiveLicenseStates,
  supabaseAdmin,
  LISTINGS_TABLE,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;

const STATIC_ENTRIES: { path: string; changefreq: string; priority: string }[] = [
  { path: "", changefreq: "daily", priority: "1.0" },
  { path: "/directory", changefreq: "daily", priority: "0.9" },
  { path: "/pricing", changefreq: "weekly", priority: "0.7" },
  { path: "/about", changefreq: "monthly", priority: "0.4" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const match = /^(\d+)\.xml$/.exec(params.id);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const id = Number(match[1]);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;

  // State pages only for states with bar attorneys (TDL #458 + criterion #3).
  const activeStates = await getActiveLicenseStates();
  const activeRegions = REGIONS.filter((r) => activeStates.includes(r.province));

  const headers = STATIC_ENTRIES.length + activeRegions.length;
  const firstChunkListingCapacity = Math.max(0, CHUNK_SIZE - headers);

  const offset =
    id === 0 ? 0 : firstChunkListingCapacity + (id - 1) * CHUNK_SIZE;
  const limit = id === 0 ? firstChunkListingCapacity : CHUNK_SIZE;

  const listings = await getListingsRange(offset, limit);
  const now = new Date().toISOString();

  const parts: string[] = [];

  if (id === 0) {
    for (const e of STATIC_ENTRIES) {
      parts.push(urlEntry(`${baseUrl}${e.path}`, now, e.changefreq, e.priority));
    }
    for (const region of activeRegions) {
      parts.push(urlEntry(`${baseUrl}/${region.slug}`, now, "daily", "0.8"));
    }
    // City pages (/{province_state}/{region_slug}) — only rows that carry both
    // (legal: EOIR location set). Country-scoped to avoid CA leakage into the
    // US sitemap. Server-side filter returns the small populated subset.
    const { data: cityRows } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("province_state, region_slug")
      .eq("country", verticalConfig.defaultCountry)
      .not("province_state", "is", null)
      .not("region_slug", "is", null)
      .limit(1000000);
    const seenCity = new Set<string>();
    for (const row of cityRows ?? []) {
      const ps = (row as { province_state: string | null }).province_state;
      const rs = (row as { region_slug: string | null }).region_slug;
      if (!ps || !rs) continue;
      const key = `${ps}/${rs}`;
      if (seenCity.has(key)) continue;
      seenCity.add(key);
      parts.push(urlEntry(`${baseUrl}/${ps}/${rs}`, now, "weekly", "0.7"));
    }
  }

  for (const l of listings) {
    const raw = l.updated_at || l.created_at;
    const lastmod = raw ? new Date(raw).toISOString() : now;
    parts.push(urlEntry(`${baseUrl}/directory/${l.slug}`, lastmod, "weekly", "0.6"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${parts.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
