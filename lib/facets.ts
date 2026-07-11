// City-page facet summary — a data-derived GROUP BY over OUR OWN enriched listings.
// Zero LLM calls at render time; aggregates the empire_listing_enrichment sidecar
// for exactly the listings shown on the page, collapsed to a CANONICAL vocabulary
// (lib/canonical-vocab.json — deterministic, inspectable map, no synonym-split).
//
// De-serve floor (same gap-fill discipline as EnrichmentBlock): the block renders
// NOTHING unless there are >= M_MIN enriched listings AND >= N_MIN distinct canonical
// facets each backed by >= 2 listings. A thin city gets no summary rather than a
// thin one.
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import canonicalVocab from "@/lib/canonical-vocab.json";

const M_MIN = 8; // min enriched listings on the page
const N_MIN = 5; // min distinct canonical facets, each backed by >= 2 listings

export interface CityFacets {
  enrichedCount: number;
  totalCount: number;
  services: { term: string; count: number }[]; // canonical, desc, each count >= 2
  ratedCount: number;
  avgRating: number | null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map a raw LLM term to its canonical label. Unknown terms fall back to Title Case
// (identity) so new enrichment still renders; the shipped map covers current data.
function canon(vertical: string, raw: string): string | null {
  const t = String(raw || "").toLowerCase().trim();
  if (!t) return null;
  const map = (canonicalVocab as Record<string, Record<string, string>>)[vertical] || {};
  return map[t] || titleCase(t);
}

interface FacetListing { id: string | number; google_rating?: number | null }

// Experiment holdout: FACET_HELD cities render nothing (control arm). A city not in
// facet_assignment defaults to ON — the M>=8/N>=5 floor still gates it.
async function facetHeld(vertical: string, provinceState: string, regionSlug: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("facet_assignment")
    .select("facet_on")
    .eq("vertical", vertical)
    .eq("province_state", provinceState.toUpperCase())
    .eq("region_slug", regionSlug)
    .maybeSingle();
  if (error || !data) return false; // not assigned => not held
  return data.facet_on === false;
}

export async function getCityFacets(
  listings: FacetListing[],
  vertical: string,
  provinceState: string,
  regionSlug: string
): Promise<CityFacets | null> {
  const totalCount = listings.length;
  const ids = listings.map((l) => String(l.id));
  if (ids.length < M_MIN) return null; // can't clear floor; skip the query entirely
  if (await facetHeld(vertical, provinceState, regionSlug)) return null; // FACET_HELD control

  // ONE batch query for the whole city — never 200 per-slug round-trips.
  const { data, error } = await supabaseAdmin
    .from("empire_listing_enrichment")
    .select("structured")
    .eq("listing_table", LISTINGS_TABLE)
    .eq("is_latest", true)
    .in("listing_id", ids);
  if (error || !data) return null;

  const enrichedCount = data.length;
  if (enrichedCount < M_MIN) return null;

  // Count DISTINCT listings per canonical term (services + specialties).
  const termCounts = new Map<string, number>();
  for (const row of data as { structured: Record<string, unknown> }[]) {
    const s = row.structured || {};
    const terms = new Set<string>();
    for (const field of ["services", "specialties"]) {
      const arr = Array.isArray(s[field]) ? (s[field] as unknown[]) : [];
      for (const raw of arr) {
        const c = canon(vertical, String(raw));
        if (c) terms.add(c);
      }
    }
    terms.forEach((c) => termCounts.set(c, (termCounts.get(c) || 0) + 1));
  }

  const services = Array.from(termCounts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([term, count]) => ({ term, count }));

  if (services.length < N_MIN) return null; // floor: >= 5 distinct facts, each >= 2 listings

  const rated = listings.filter(
    (l) => typeof l.google_rating === "number" && (l.google_rating as number) > 0
  );
  const avgRating = rated.length
    ? rated.reduce((a, l) => a + (l.google_rating as number), 0) / rated.length
    : null;

  return { enrichedCount, totalCount, services, ratedCount: rated.length, avgRating };
}
