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
      .eq("country", "CA")
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true }).limit(200);

    if (regionSlug) {
      query = query.eq("region", regionSlug);
    }

    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export interface ListingFilters {
  q?: string;
  listing_type?: string;
  region?: string;
}

export async function getFilteredListings(filters: ListingFilters): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .eq("country", "CA")
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true }).limit(200);

    if (filters.region) {
      query = query.eq("region", filters.region);
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
      .eq("country", "CA")
      .eq("province_state", provinceCode.toUpperCase())
      .eq("region_slug", citySlug)
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true }).limit(200);
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export async function getListing(slug: string): Promise<Listing | null> {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .eq("country", "CA")
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
      .eq("country", "CA");
    if (regionSlug) {
      query = query.eq("region_slug", regionSlug);
    }
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  });
}
