import { createClient } from "@supabase/supabase-js";
import verticalConfig from "@/lib/vertical.config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: "no-store" });
    },
  },
});

// PostgREST caps unranged queries at 1000 rows. Loop .range() in 50000-row pages
// to fetch the full result set. Factory pattern is required because Supabase
// query builders cannot be reused after await.
const PAGE_SIZE = 50_000;
const HARD_CAP = 500_000;

async function paginateAll<T>(
  queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  options: { maxRows?: number } = {}
): Promise<T[]> {
  const upper = options.maxRows ?? HARD_CAP;
  const all: T[] = [];
  let from = 0;
  while (from < upper) {
    const to = Math.min(from + PAGE_SIZE - 1, upper - 1);
    const builder = queryFactory() as unknown as {
      range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
    };
    const { data, error } = await builder.range(from, to);
    if (error) {
      console.error("paginateAll error:", error);
      return all;
    }
    const page = data || [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// User-facing pages cap their listing fetch — sitemap goes via getListingsRange.
const USER_PAGE_MAX_ROWS = 200;


// Table names derived from config prefix
export const LISTINGS_TABLE = `${verticalConfig.tablePrefix}listings`;
export const INQUIRIES_TABLE = `${verticalConfig.tablePrefix}inquiries`;

export interface Listing {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  province_state?: string;
  country?: string;
  region_slug?: string;
  listing_type?: string;
  owner_auth_token?: string;
  owner_email?: string;
  owner_name?: string;
  is_claimed?: boolean;
  claim_verified?: boolean;
  claimed_at?: string;
  claimed: boolean;
  featured: boolean;
  now_hiring?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_tier?: string;
  tier?: string;
  tier_activated_at?: string;
  tier_priority?: number;
  siteforge_url?: string;
  siteforge_status?: string;
  custom_domain?: string;
  payment_error_review?: boolean;
  google_rating?: number;
  google_review_count?: number;
  photo_urls?: string[];
  created_at: string;
  updated_at?: string;
}

export async function getListings(regionSlug?: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name_sortkey", { ascending: true }).limit(200);

    if (regionSlug) {
      // TDL #458: state pages partition by license_state (bar-of-record), NOT
      // state_province (physical location, ~all null for bar rows) — see #452.
      // Two-letter slug → license_state match. Longer slugs → legacy `region`.
      if (regionSlug.length === 2) {
        query = query.eq("license_state", regionSlug.toUpperCase());
      } else {
        query = query.eq("region", regionSlug);
      }
    }

    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export interface ListingFilters {
  q?: string;
  listing_type?: string;
  region?: string;
  city?: string;
}

export async function getFilteredListings(filters: ListingFilters): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name_sortkey", { ascending: true }).limit(200);

    if (filters.region) {
      // TDL #458: bar-of-record via license_state, not state_province.
      if (filters.region.length === 2) {
        query = query.eq("license_state", filters.region.toUpperCase());
      } else {
        query = query.eq("region", filters.region);
      }
    }
    if (filters.listing_type) {
      query = query.eq("listing_type", filters.listing_type);
    }
    if (filters.q) {
      const term = filters.q.replace(/'/g, "''");
      query = query.or(
        `name.ilike.%${term}%,city.ilike.%${term}%`
      );
    }

    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}


export async function getListingsByCity(provinceCode: string, citySlug: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    const query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .eq("province_state", provinceCode.toUpperCase())
      .eq("region_slug", citySlug)
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name_sortkey", { ascending: true }).limit(200);
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export async function getListing(slug: string): Promise<Listing | null> {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .eq("country", verticalConfig.defaultCountry)
    .neq("is_published", false)
    .eq("slug", slug)
    .single();

  if (error) {
    console.error(`Error fetching listing "${slug}" from ${LISTINGS_TABLE}:`, error);
    return null;
  }
  return data;
}


// Uncapped variant of getListings for sitemap generation. Calls paginateAll
// without any maxRows option and with no per-page .limit() so the full result
// set (up to HARD_CAP) is returned. Sitemaps must enumerate every listing URL;
// user-facing /directory pages use the capped getListings instead.
export async function getAllListingsForSitemap(regionSlug?: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .eq("country", verticalConfig.defaultCountry).neq("is_published", false);
    if (regionSlug) {
      query = query.eq("region_slug", regionSlug);
    }
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  });
}

// === TDL #457: chunked sitemap support ===
// Total count of consumer-visible listings (country-scoped). Drives the
// sitemap-index chunk math. head:true → no rows transferred.
export async function getListingsCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("country", verticalConfig.defaultCountry).neq("is_published", false);
  if (error) {
    console.error("getListingsCount error:", error);
    return 0;
  }
  return count || 0;
}

// Minimal-projection ranged fetch for sitemap chunks. Selects only the columns
// the sitemap needs (slug, timestamps) — the old getAllListingsForSitemap did
// select("*") over ~194K rows and timed the route out (TDL #457). Stable order
// (slug is unique) so chunk boundaries don't drift between requests.
export async function getListingsRange(
  offset: number,
  limit: number
): Promise<Pick<Listing, "slug" | "updated_at" | "created_at">[]> {
  if (limit <= 0) return [];
  const all: Pick<Listing, "slug" | "updated_at" | "created_at">[] = [];
  const end = offset + limit;
  let from = offset;
  while (from < end) {
    const to = Math.min(from + PAGE_SIZE, end) - 1;
    const { data, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("slug, updated_at, created_at")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .order("slug", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("getListingsRange error:", error);
      return all;
    }
    const page = (data || []) as Pick<Listing, "slug" | "updated_at" | "created_at">[];
    all.push(...page);
    const requested = to - from + 1;
    if (page.length < requested) break;
    from = to + 1;
  }
  return all;
}

// Distinct bar-of-record states present in the consumer-visible set. Used to
// emit state-page sitemap entries ONLY for states with attorneys (TDL #458 +
// criterion #3: no 404 URLs in the sitemap). Self-maintaining as bars load.
export async function getActiveLicenseStates(): Promise<string[]> {
  const rows = await paginateAll<{ license_state: string | null }>(() => {
    return supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("license_state")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .not("license_state", "is", null) as unknown as PromiseLike<{
        data: { license_state: string | null }[] | null;
        error: unknown;
      }>;
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.license_state) set.add(r.license_state.toUpperCase());
  }
  return Array.from(set).sort();
}

// Distinct (province_state, region_slug) city pages in the consumer-visible US
// set — drives the /{state}/{city} sitemap entries. MUST paginate (not a raw
// .limit() select): there are ~234K populated rows but only ~1.6K distinct city
// pages, and an unranged select silently truncated at the PostgREST cap, dropping
// the long-tail of rare cities from the sitemap. Self-maintaining as rows fill.
// (TDL #464 Phase 4.)
export async function getCityPageSlugs(): Promise<
  { province_state: string; region_slug: string }[]
> {
  const rows = await paginateAll<{
    province_state: string | null;
    region_slug: string | null;
  }>(() => {
    return supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("province_state, region_slug")
      .eq("country", verticalConfig.defaultCountry)
      .neq("is_published", false)
      .not("province_state", "is", null)
      .not("region_slug", "is", null) as unknown as PromiseLike<{
        data: { province_state: string | null; region_slug: string | null }[] | null;
        error: unknown;
      }>;
  });
  const seen = new Set<string>();
  const out: { province_state: string; region_slug: string }[] = [];
  for (const r of rows) {
    if (!r.province_state || !r.region_slug) continue;
    const key = `${r.province_state}/${r.region_slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ province_state: r.province_state, region_slug: r.region_slug });
  }
  return out;
}

// Real total for a filtered view (decision #3): the directory/region pages cap
// their rendered cards at 200 but must DISPLAY the true count — "200 lawyers"
// when CA alone has 187K is a credibility leak. Mirrors getFilteredListings'
// predicates exactly; head:true so no rows are transferred.
export async function getFilteredListingsCount(filters: ListingFilters): Promise<number> {
  let query = supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("country", verticalConfig.defaultCountry).neq("is_published", false);
  if (filters.region) {
    if (filters.region.length === 2) {
      query = query.eq("license_state", filters.region.toUpperCase());
    } else {
      query = query.eq("region", filters.region);
    }
  }
  if (filters.listing_type) {
    query = query.eq("listing_type", filters.listing_type);
  }
  if (filters.q) {
    const term = filters.q.replace(/'/g, "''");
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  }
  const { count, error } = await query;
  if (error) {
    console.error("getFilteredListingsCount error:", error);
    return 0;
  }
  return count || 0;
}

// FIX-EMPIRE-F7-SWEEP — runtime regions facets for cascading dropdowns.
// DISTINCT (province_state, city) filtered to canonical 64 codes. 5-min cache.
export interface DirectoryRegion {
  slug: string;
  name: string;
  province: string;
}

const CANONICAL_PROVINCE_CODES = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

function slugifyCityName(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function titleCaseCity(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

let _directoryRegionsCache: { ts: number; data: DirectoryRegion[] } | null = null;
const DIRECTORY_REGIONS_TTL_MS = 5 * 60 * 1000;

export async function getDirectoryRegions(): Promise<DirectoryRegion[]> {
  if (_directoryRegionsCache && Date.now() - _directoryRegionsCache.ts < DIRECTORY_REGIONS_TTL_MS) {
    return _directoryRegionsCache.data;
  }

  const rows = await paginateAll<{ province_state: string | null; city: string | null }>(() => {
    return supabaseAdmin
      .from(`mv_${LISTINGS_TABLE}_cities`)
      .select("province_state, city")
      .in("country", ["CA", "US"])
      .neq("is_published", false)
      .in("province_state", CANONICAL_PROVINCE_CODES)
      .not("city", "is", null)
      .neq("city", "") as unknown as PromiseLike<{
        data: { province_state: string | null; city: string | null }[] | null;
        error: unknown;
      }>;
  });

  const seen = new Map<string, { name: string; province: string }>();
  for (const r of rows) {
    if (!r.city || !r.province_state) continue;
    const cleaned = r.city.trim();
    if (!cleaned) continue;
    const baseSlug = slugifyCityName(cleaned);
    if (!baseSlug) continue;
    const key = `${r.province_state}::${baseSlug}`;
    if (!seen.has(key)) {
      const name = cleaned === cleaned.toLowerCase() ? titleCaseCity(cleaned) : cleaned;
      seen.set(key, { name, province: r.province_state });
    }
  }

  const slugProvinces = new Map<string, Set<string>>();
  Array.from(seen.keys()).forEach((key) => {
    const [prov, baseSlug] = key.split("::");
    if (!slugProvinces.has(baseSlug)) slugProvinces.set(baseSlug, new Set());
    slugProvinces.get(baseSlug)!.add(prov);
  });

  const out: DirectoryRegion[] = [];
  Array.from(seen.entries()).forEach(([key, val]) => {
    const [, baseSlug] = key.split("::");
    const slug =
      (slugProvinces.get(baseSlug)?.size ?? 0) > 1
        ? `${baseSlug}-${val.province.toLowerCase()}`
        : baseSlug;
    out.push({ slug, name: val.name, province: val.province });
  });

  out.sort(
    (a, b) =>
      a.province.localeCompare(b.province) || a.name.localeCompare(b.name)
  );

  _directoryRegionsCache = { ts: Date.now(), data: out };
  return out;
}
