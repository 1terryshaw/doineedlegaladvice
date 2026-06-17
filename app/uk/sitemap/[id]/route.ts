import verticalConfig from "@/lib/vertical.config";
import {
  getUkCounties,
  getUkAllTownHubs,
  getUkFirmsRange,
} from "@/lib/uk-solicitors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 45_000;

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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const match = /^(\d+)\.xml$/.exec(params.id);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const id = Number(match[1]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  const now = new Date().toISOString();
  const parts: string[] = [];

  if (id === 0) {
    // Static + county + town-hub URLs (no firms — those live in chunks 1..N).
    parts.push(urlEntry(`${baseUrl}/uk`, now, "daily", "0.9"));
    parts.push(urlEntry(`${baseUrl}/uk/privacy`, now, "monthly", "0.3"));
    const [counties, townHubs] = await Promise.all([getUkCounties(), getUkAllTownHubs()]);
    for (const c of counties) {
      parts.push(urlEntry(`${baseUrl}/uk/${c.county_slug}`, now, "weekly", "0.8"));
    }
    for (const t of townHubs) {
      parts.push(urlEntry(`${baseUrl}/uk/${t.county_slug}/${t.town_slug}`, now, "weekly", "0.7"));
    }
  } else {
    const offset = (id - 1) * CHUNK_SIZE;
    const firms = await getUkFirmsRange(offset, CHUNK_SIZE);
    for (const f of firms) {
      if (!f.id) continue;
      const raw = f.updated_at || f.created_at;
      const lastmod = raw ? new Date(raw).toISOString() : now;
      parts.push(urlEntry(`${baseUrl}/uk/directory/${f.id}`, lastmod, "weekly", "0.6"));
    }
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
