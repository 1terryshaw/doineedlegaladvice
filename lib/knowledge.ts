// Server-side, FAIL-OPEN client for the Empire Knowledge API. The x-empire-key is read from a
// non-public env var and never leaves the server. Any failure (missing env, timeout, non-200,
// not-found, bad JSON) returns null so the page renders normally without the enrichment block.
// AI enrichment is supplementary — never load-bearing.

export interface KnowledgeData {
  knowledge: {
    description: string | null;
    services: string[];
    specialties: string[];
    service_areas: string[];
    languages: string[];
    team_size: string | null;
    year_established: string | null;
    hours: string | null;
    certifications: string[];
  };
  meta: {
    source_url: string | null;
    provider: string | null;
    model: string | null;
    updated_at: string;
    schema_version: number | null;
  };
}

const TIMEOUT_MS = 2500;

// Cache the enrichment for 24h — the ISR-compatible pattern proven across the fleet since
// 2026-07-17. `cache: "no-store"` here discarded the API's own `s-maxage=3600` on EVERY detail
// render, producing one uncached knowledge-API call per page view. Only the TRANSPORT is cached;
// the payload is byte-identical. The tag `enrichment:<vertical>:<slug>` allows a targeted
// revalidateTag() purge on re-enrichment.
const ENRICHMENT_REVALIDATE_SECONDS = 86400;

export async function getEnrichment(vertical: string, slug: string | null | undefined): Promise<KnowledgeData | null> {
  // TDL #1284 hop removal: read the enrichment sidecar directly (same Supabase project) instead of a
  // cross-project call to empire-knowledge-api, which was 98.5% cache MISS (one extra function per render).
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !slug) return null; // not configured / no slug => fail open

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const url = `${base}/rest/v1/empire_listing_enrichment?select=${ENRICHMENT_COLS}&vertical=eq.${encodeURIComponent(vertical)}&listing_slug=eq.${encodeURIComponent(slug)}&is_latest=eq.true&json_valid=eq.true&order=created_at.desc&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ac.signal,
      next: { revalidate: ENRICHMENT_REVALIDATE_SECONDS, tags: [`enrichment:${vertical}:${slug}`] },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    const data = toContract(Array.isArray(rows) ? ((rows[0] as EnrichmentRow | undefined) ?? null) : null);
    if (!data?.found || !data.knowledge || !data.meta?.updated_at) return null;
    return { knowledge: data.knowledge, meta: data.meta };
  } catch {
    return null; // timeout / network / parse — fail open
  } finally {
    clearTimeout(timer);
  }
}


// ---- knowledge-api contract, inlined (empire-knowledge-api lib/contract.ts @ f2bee7b) — TDL #1284 hop removal ----
const ENRICHMENT_COLS = "structured,source_url,provider,model,schema_version,json_valid,created_at";
const MIN_FIELDS = 2;
const ARRAY_KEYS = ["services", "specialties", "service_areas", "languages", "certifications"] as const;
const SCALAR_KEYS = ["description", "team_size", "year_established", "hours"] as const;
interface EnrichmentRow { structured: Record<string, unknown> | null; source_url: string | null; provider: string | null; model: string | null; schema_version: number | null; json_valid: boolean | null; created_at: string }
function toContract(row: EnrichmentRow | null): { found: boolean; knowledge?: KnowledgeData["knowledge"]; meta?: KnowledgeData["meta"] } {
  if (!row || row.json_valid !== true) return { found: false };
  const o = row.structured ?? {};
  const k = {} as Record<string, unknown>;
  let n = 0;
  for (const key of ARRAY_KEYS) { const v = o[key]; const a = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []; k[key] = a; if (a.length > 0) n++; }
  for (const key of SCALAR_KEYS) { const v = o[key]; const x = typeof v === "string" && v.trim().length > 0 ? v : null; k[key] = x; if (x !== null) n++; }
  if (n < MIN_FIELDS) return { found: false };
  return { found: true, knowledge: k as unknown as KnowledgeData["knowledge"], meta: { source_url: row.source_url, provider: row.provider, model: row.model, updated_at: row.created_at, schema_version: row.schema_version } };
}
