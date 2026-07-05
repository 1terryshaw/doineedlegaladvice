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

export async function getEnrichment(vertical: string, slug: string | null | undefined): Promise<KnowledgeData | null> {
  const base = process.env.KNOWLEDGE_API_URL;
  const key = process.env.EMPIRE_KNOWLEDGE_API_KEY;
  if (!base || !key || !slug) return null; // not configured / no slug => fail open

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const url = `${base}/v1/enrichment/by-slug?vertical=${encodeURIComponent(vertical)}&slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, {
      headers: { "x-empire-key": key },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { found?: boolean; knowledge?: KnowledgeData["knowledge"]; meta?: KnowledgeData["meta"] };
    if (!data?.found || !data.knowledge || !data.meta?.updated_at) return null;
    return { knowledge: data.knowledge, meta: data.meta };
  } catch {
    return null; // timeout / network / parse — fail open
  } finally {
    clearTimeout(timer);
  }
}
