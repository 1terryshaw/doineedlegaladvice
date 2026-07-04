// TDL #661 — region-hub + pagination query helpers.
// Lives in its own module because lib/supabase.ts is on this repo's DO-NOT-TOUCH
// list (per CLAUDE.md). Reuses supabaseAdmin + LISTINGS_TABLE from supabase.ts.
import { sanitizeOrTerm, supabaseAdmin, LISTINGS_TABLE, type Listing } from "@/lib/supabase";

export const REGION_PAGE_SIZE = 48;

// TDL #458 — legal_listings region is disjoint: US filters by license_state
// (bar-of-record), CA by province_state. 2-letter region code -> column.
const CA_CODES = new Set(["ON","QC","BC","AB","MB","SK","NS","NB","NL","PE","NT","NU","YT"]);
function regionColumn(code: string): "license_state" | "province_state" {
  return CA_CODES.has(code.toUpperCase()) ? "province_state" : "license_state";
}

export interface ListingFiltersPaged {
  q?: string;
  listing_type?: string;
  region?: string;
  city?: string;
  page?: number;
  perPage?: number;
}

// Paginated /directory text/specialty search. One page via .range() (look-ahead
// row for next-page detection) instead of the legacy 200-row cap.
export async function getFilteredListingsPaged(filters: ListingFiltersPaged): Promise<Listing[]> {
  const perPage = filters.perPage ?? REGION_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * perPage;
  const to = from + perPage; // inclusive end → perPage+1 rows

  let query = supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .order("tier_priority", { ascending: false, nullsFirst: false })
    .order("featured", { ascending: false, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("name_sortkey", { ascending: true });

  if (filters.region) {
    const r = filters.region.trim();
    if (filters.city) {
      const provCode = r.toUpperCase();
      const c = filters.city.trim();
      const cityText = c.replace(/-/g, " ");
      query = query
        .eq("province_state", provCode)
        .or(`region_slug.eq.${c},region_slug.eq.${c}-${provCode.toLowerCase()},city.ilike.${cityText},city.ilike.${c}`);
    } else if (/^[a-z]{2}$/i.test(r)) {
      query = query.eq(regionColumn(r), r.toUpperCase());
    } else {
      const suffixMatch = r.match(/^(.+)-([a-z]{2})$/i);
      if (suffixMatch) {
        const [, cityBase, prov] = suffixMatch;
        const cityText = cityBase.replace(/-/g, " ");
        query = query
          .eq("province_state", prov.toUpperCase())
          .or(`region_slug.eq.${r},region_slug.eq.${cityBase},city.ilike.${cityText},city.ilike.${cityBase}`);
      } else {
        const cityText = r.replace(/-/g, " ");
        query = query.or(`region_slug.eq.${r},city.ilike.${cityText},city.ilike.${r}`);
      }
    }
  }
  if (filters.listing_type) query = query.eq("listing_type", filters.listing_type);
  if (filters.q) {
    const term = sanitizeOrTerm(filters.q);
    query = query.or(`name.ilike.${term},city.ilike.${term}`);
  }

  const { data, error } = await query.range(from, to);
  if (error) {
    console.error("getFilteredListingsPaged error:", error);
    return [];
  }
  return data || [];
}

// Per-province counts for the region hub, from mv_${table}_regions (<1ms). 5-min cache.
export interface RegionCount {
  country: string;
  province_state: string;
  n: number;
}

let _regionCountsCache: { ts: number; data: RegionCount[] } | null = null;
const REGION_COUNTS_TTL_MS = 5 * 60 * 1000;

export async function getRegionCounts(): Promise<RegionCount[]> {
  if (_regionCountsCache && Date.now() - _regionCountsCache.ts < REGION_COUNTS_TTL_MS) {
    return _regionCountsCache.data;
  }
  const { data, error } = await supabaseAdmin
    .from(`mv_${LISTINGS_TABLE}_regions`)
    .select("country, province_state, n");
  if (error) {
    console.error("getRegionCounts error:", error);
    return _regionCountsCache?.data ?? [];
  }
  const rows = (data || []).map((r) => ({
    country: String(r.country),
    province_state: String(r.province_state),
    n: Number(r.n) || 0,
  }));
  _regionCountsCache = { ts: Date.now(), data: rows };
  return rows;
}

export async function getRegionTotal(provinceCode: string): Promise<number> {
  const code = provinceCode.toUpperCase();
  const counts = await getRegionCounts();
  return counts.find((c) => c.province_state === code)?.n ?? 0;
}

// Total published listings for the hub headline (this repo's supabase.ts has no
// getListingsCount export, and it is DO-NOT-TOUCH). HEAD count, no row data.
export async function getDirectoryTotal(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*", { count: "exact", head: true })
    .in("country", ["CA", "US"])
    .neq("is_published", false);
  if (error) {
    console.error("getDirectoryTotal error:", error);
    return 0;
  }
  return count || 0;
}

// One page of a province's listings, ordered to EXACTLY match
// idx_${table}_province_sort so deep pagination stays a ~1ms index scan.
export async function getListingsByProvincePaged(
  provinceCode: string,
  page: number,
  perPage: number = REGION_PAGE_SIZE,
): Promise<Listing[]> {
  const p = Math.max(1, page);
  const from = (p - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .eq(regionColumn(provinceCode), provinceCode.toUpperCase())
    .order("tier_priority", { ascending: false, nullsFirst: false })
    .order("featured", { ascending: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, to);
  if (error) {
    console.error(`getListingsByProvincePaged(${provinceCode}) error:`, error);
    return [];
  }
  return data || [];
}
