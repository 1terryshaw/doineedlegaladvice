// lib/uk-solicitors.ts — UK SOLICITOR DIRECTORY DATA LAYER (/uk/ subfolder)
//
// PARALLEL to the legal_listings layer in lib/supabase.ts — it reuses only the
// service-role client. It reads the SEPARATE, gated `uk_solicitors` table (Companies
// House SIC 69102/69109 + LLP name-search + LSNI roster) and the two is_published-gated
// stat views. Nothing here touches legal_listings or the existing claim flow.
//
// Geo hierarchy: county -> town -> firm. Firm slug = `id` (uuid), NOT company_number —
// uk_solicitors has LSNI rows with company_number IS NULL, so the uuid PK is the only
// universal stable key. Town hubs render only at >= N firms (thin-content guard).
import { createClient } from "@supabase/supabase-js";

// ISR (2026-08-24, K32 /uk ISR pilot): the shared `supabaseAdmin` in lib/supabase.ts
// hardcodes `cache: "no-store"` in a global fetch override. Per the Next docs an explicit
// no-store fetch forces the WHOLE route to render dynamically, and route-level
// fetchCache="force-cache" does NOT override it in practice - verified empirically with
// `export const dynamic = "error"`, which named this exact fetch as the blocker:
//   Route /uk ... couldn't be rendered statically because it used `no-store fetch
//   https://<ref>.supabase.co/rest/v1/uk_..._county_stats`.
// So the /uk data layer gets its OWN service-role client that sets NO cache option, and
// each /uk route's own segment config decides:
//   /uk, /uk/directory/[slug]  -> fetchCache="force-cache"    => ISR, cached at the edge
//   /uk/claim/[slug]           -> fetchCache="force-no-store" => always fresh (claims)
//   /uk/sitemap*, /directory   -> revalidate=0/force-no-store => always fresh
// Same URL + service-role key as lib/supabase.ts; the ONLY difference is the absent
// no-store override. lib/supabase.ts is deliberately left untouched so nothing outside
// /uk changes behaviour.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const UK_TABLE = "uk_solicitors";
export const COUNTY_STATS_VIEW = "uk_solicitors_county_stats";
export const TOWN_STATS_VIEW = "uk_solicitors_town_stats";

export const TOWN_PAGE_MIN_FIRMS = 3;
const FIRM_LIST_CAP = 200;
const PAGE_SIZE = 50_000;

export type UkJurisdiction = "eng_wales" | "scotland" | "ni";

// Three UK legal jurisdictions, each its own regulator.
export const REGULATOR_BY_JURISDICTION: Record<
  UkJurisdiction,
  { acronym: string; full: string }
> = {
  eng_wales: { acronym: "SRA", full: "Solicitors Regulation Authority" },
  scotland: { acronym: "LSS", full: "Law Society of Scotland" },
  ni: { acronym: "LSNI", full: "Law Society of Northern Ireland" },
};

export function isUkJurisdiction(v: string | null | undefined): v is UkJurisdiction {
  return v === "eng_wales" || v === "scotland" || v === "ni";
}

export interface UkFirm {
  id: string;
  business_name: string;
  source: string;
  company_number: string | null;
  company_type: string | null;
  jurisdiction: UkJurisdiction | null;
  regulator: string | null;
  regulator_id: string | null;
  registered_address: string | null; // composed from address parts
  source_profile_url: string | null; // derived Companies House URL (null for LSNI)
  town: string | null;
  county: string | null;
  region: string | null;
  postcode: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  is_published: boolean;
  is_claimed: boolean | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CountyStat {
  county: string;
  county_slug: string;
  firm_count: number;
}

export interface TownStat {
  county: string;
  town: string;
  county_slug: string;
  town_slug: string;
  firm_count: number;
}

// Raw columns selected from uk_solicitors (mapped into UkFirm via mapFirm).
const RAW_FIRM_COLS =
  "id, business_name, source, company_number, company_type, jurisdiction, regulator, regulator_id, address_line_1, address_line_2, locality, postal_code, region, county, town, website, email, phone, is_published, is_claimed, owner_email, created_at, updated_at";

interface RawFirmRow {
  id: string;
  business_name: string;
  source: string;
  company_number: string | null;
  company_type: string | null;
  jurisdiction: string | null;
  regulator: string | null;
  regulator_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  locality: string | null;
  postal_code: string | null;
  region: string | null;
  county: string | null;
  town: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  is_published: boolean;
  is_claimed: boolean | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string | null;
}

const CH_PROFILE_BASE = "https://find-and-update.company-information.service.gov.uk";

function composeAddress(r: RawFirmRow): string | null {
  const parts = [r.address_line_1, r.address_line_2, r.locality]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function mapFirm(r: RawFirmRow): UkFirm {
  return {
    id: r.id,
    business_name: r.business_name,
    source: r.source,
    company_number: r.company_number,
    company_type: r.company_type,
    jurisdiction: isUkJurisdiction(r.jurisdiction) ? r.jurisdiction : null,
    regulator: r.regulator,
    regulator_id: r.regulator_id,
    registered_address: composeAddress(r),
    // Only Companies House rows have a verifiable public record; LSNI rows do not.
    source_profile_url: r.company_number ? `${CH_PROFILE_BASE}/company/${r.company_number}` : null,
    town: r.town,
    county: r.county,
    region: r.region,
    postcode: r.postal_code,
    website: r.website,
    email: r.email,
    phone: r.phone,
    is_published: r.is_published,
    is_claimed: r.is_claimed,
    owner_email: r.owner_email,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Slugify a county/town name for /uk/ URLs. MUST stay byte-for-byte identical to the
 * slug expression in the stat-view migrations (lower -> runs of [^a-z0-9] become '-' ->
 * trim leading/trailing '-') so a route param resolves against the *_slug columns.
 */
export function ukSlugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Geo hubs (read the cheap, is_published-gated stat views) ---

export async function getUkCounties(): Promise<CountyStat[]> {
  const { data, error } = await supabaseAdmin
    .from(COUNTY_STATS_VIEW)
    .select("county, county_slug, firm_count")
    .order("county", { ascending: true })
    .limit(5000);
  if (error) {
    console.error("getUkCounties error:", error.message);
    return [];
  }
  return (data ?? []) as CountyStat[];
}

export async function getUkCountyBySlug(countySlug: string): Promise<CountyStat | null> {
  const { data, error } = await supabaseAdmin
    .from(COUNTY_STATS_VIEW)
    .select("county, county_slug, firm_count")
    .eq("county_slug", countySlug)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getUkCountyBySlug error:", error.message);
    return null;
  }
  return (data as CountyStat) ?? null;
}

export async function getUkTownsInCounty(
  countySlug: string,
  minFirms = TOWN_PAGE_MIN_FIRMS
): Promise<TownStat[]> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .eq("county_slug", countySlug)
    .gte("firm_count", minFirms)
    .order("firm_count", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("getUkTownsInCounty error:", error.message);
    return [];
  }
  return (data ?? []) as TownStat[];
}

export async function getUkTownBySlug(
  countySlug: string,
  townSlug: string
): Promise<TownStat | null> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .eq("county_slug", countySlug)
    .eq("town_slug", townSlug)
    .order("firm_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getUkTownBySlug error:", error.message);
    return null;
  }
  return (data as TownStat) ?? null;
}

export async function getUkAllTownHubs(minFirms = TOWN_PAGE_MIN_FIRMS): Promise<TownStat[]> {
  const { data, error } = await supabaseAdmin
    .from(TOWN_STATS_VIEW)
    .select("county, town, county_slug, town_slug, firm_count")
    .gte("firm_count", minFirms)
    .order("county_slug", { ascending: true })
    .limit(100_000);
  if (error) {
    console.error("getUkAllTownHubs error:", error.message);
    return [];
  }
  return (data ?? []) as TownStat[];
}

// --- Firms (slug = uuid id) ---

/** A single published firm by its uuid id. Null geo rows are never published. */
export async function getUkFirm(id: string): Promise<UkFirm | null> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(RAW_FIRM_COLS)
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error) {
    console.error(`getUkFirm("${id}") error:`, error.message);
    return null;
  }
  return data ? mapFirm(data as RawFirmRow) : null;
}

/** Firm lookup for the CLAIM flow — by id, still only published rows. */
export async function getUkFirmForClaim(id: string): Promise<UkFirm | null> {
  return getUkFirm(id);
}

export async function getUkFirmsByCounty(
  county: string,
  limit = FIRM_LIST_CAP
): Promise<UkFirm[]> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(RAW_FIRM_COLS)
    .eq("is_published", true)
    .eq("county", county)
    .order("is_claimed", { ascending: false, nullsFirst: false })
    .order("business_name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getUkFirmsByCounty error:", error.message);
    return [];
  }
  return ((data ?? []) as RawFirmRow[]).map(mapFirm);
}

export async function getUkFirmsByTown(
  county: string,
  town: string,
  limit = FIRM_LIST_CAP
): Promise<UkFirm[]> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(RAW_FIRM_COLS)
    .eq("is_published", true)
    .eq("county", county)
    .eq("town", town)
    .order("is_claimed", { ascending: false, nullsFirst: false })
    .order("business_name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getUkFirmsByTown error:", error.message);
    return [];
  }
  return ((data ?? []) as RawFirmRow[]).map(mapFirm);
}

// --- Sitemap helpers ---

export async function getUkPublishedCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("is_published", true)
    .not("county", "is", null)
    .not("town", "is", null);
  if (error) {
    console.error("getUkPublishedCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** A window of published firm ids for a sitemap chunk. */
export async function getUkFirmsRange(
  offset: number,
  limit: number
): Promise<Array<{ id: string; updated_at: string | null; created_at: string }>> {
  if (limit <= 0) return [];
  const all: Array<{ id: string; updated_at: string | null; created_at: string }> = [];
  const end = offset + limit;
  let from = offset;
  while (from < end) {
    const to = Math.min(from + PAGE_SIZE, end) - 1;
    const { data, error } = await supabaseAdmin
      .from(UK_TABLE)
      .select("id, updated_at, created_at")
      .eq("is_published", true)
      .not("county", "is", null)
      .not("town", "is", null)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("getUkFirmsRange error:", error.message);
      return all;
    }
    const page = data ?? [];
    all.push(...(page as typeof all));
    if (page.length < to - from + 1) break;
    from = to + 1;
  }
  return all;
}

/**
 * Geo of a /uk row REGARDLESS of is_published — the ONE lookup here that deliberately
 * does not apply the serve filter (K32 on-demand ISR purge, 2026-08-24).
 *
 * On de-publish we still need the row's county/town in order to purge its ANCESTOR hub
 * pages, and by then getUkFirm() returns null for exactly the rows being purged — so the
 * serve-gated reader cannot be reused for this. It selects two non-identifying geo columns
 * and nothing else: it is a cache-key resolver, never a serve path, and its result is not
 * rendered anywhere.
 *
 * Keyed on `id` (this repo's leaf slug is the row UUID, not company_number — the /uk leaf
 * slug differs per vertical and that difference is load-bearing for the fan-out).
 */
export async function getUkFirmGeoAnyState(
  id: string
): Promise<{ county: string | null; town: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select("county, town")
    .eq("id", id)
    .limit(1);
  if (error) {
    console.error(`getUkFirmGeoAnyState("${id}") error:`, error.message);
    return null;
  }
  const row = (data ?? [])[0] as { county: string | null; town: string | null } | undefined;
  return row ?? null;
}


// --- ITL1 REGION TIER (uk-region-tier-bba-day3) --------------------------------------
//
// The UK peer of a CA province / US state is the ITL1 region (12 of them: London,
// South East, …), NOT the ~190 ceremonial counties the /uk subtree routes at. This
// block is the data layer for /uk/region/[region].
//
// 🔴 THE `region` COLUMN IS NOT A CONTROLLED VOCABULARY. It is source text and it
// carries strays — uk_dentists holds one row whose region is "Nottinghamshire", which
// is a COUNTY. So the canonical list below is an ALLOWLIST: a value not in it is
// skipped, never linked, and not routable. That is the K119/K123 chips-resolve rule
// applied at the source rather than at the chip. ITL1 is a fixed 12-member statistical
// standard (ONS ITL1, formerly NUTS 1) — it is a vocabulary, not a growing set, which
// is why an allowlist is the right model here.
export const UK_ITL1_REGIONS: ReadonlyArray<{ name: string; slug: string }> = [
  { name: "London", slug: "london" },
  { name: "South East", slug: "south-east" },
  { name: "South West", slug: "south-west" },
  { name: "East of England", slug: "east-of-england" },
  { name: "East Midlands", slug: "east-midlands" },
  { name: "West Midlands", slug: "west-midlands" },
  { name: "Yorkshire and The Humber", slug: "yorkshire-and-the-humber" },
  { name: "North West", slug: "north-west" },
  { name: "North East", slug: "north-east" },
  { name: "Scotland", slug: "scotland" },
  { name: "Wales", slug: "wales" },
  { name: "Northern Ireland", slug: "northern-ireland" },
];
const ITL1_SLUGS = new Set(UK_ITL1_REGIONS.map((r) => r.slug));
const ITL1_ORDER = new Map(UK_ITL1_REGIONS.map((r, i) => [r.slug, i] as const));

// Both views slug with the SAME expression as ukSlugify() and the county views, and
// carry the same `is_published = true` gate. Because of that, every county chip a
// region hub emits has a matching row in COUNTY_STATS_VIEW by construction.
export const REGION_STATS_VIEW = `${UK_TABLE}_region_stats`;
export const REGION_COUNTY_STATS_VIEW = `${UK_TABLE}_region_county_stats`;

export interface RegionStat {
  region: string;
  region_slug: string;
  firm_count: number;
}

export interface RegionCountyStat {
  region: string;
  region_slug: string;
  county: string;
  county_slug: string;
  firm_count: number;
}
// A region hub is a NAVIGATIONAL TIER: it exists to group SEVERAL counties. A region
// whose whole published inventory sits in ONE county is not a tier, it is an ALIAS for
// that county's hub — same rows, same top-200 cards, a "browse by county" row of exactly
// one chip, and a title differing only in wording. In all three ITL1 verticals that is
// exactly one region: London, whose firms all carry the county "Greater London".
//
// So no hub is built for it (the route 404s, and it is absent from generateStaticParams
// AND from the sitemap), and its CHIP points at the county hub instead. The market keeps
// its chip; no near-duplicate page ships.
export const REGION_HUB_MIN_COUNTIES = 2;

/** region_slug -> its county rows, summed per county_slug, biggest first. */
async function regionCountyIndex(): Promise<Map<string, RegionCountyStat[]>> {
  const { data, error } = await supabaseAdmin
    .from(REGION_COUNTY_STATS_VIEW)
    .select("region, region_slug, county, county_slug, firm_count")
    .limit(20000);
  if (error) {
    console.error("regionCountyIndex error:", error.message);
    return new Map();
  }
  const m = new Map<string, RegionCountyStat[]>();
  for (const r of (data ?? []) as RegionCountyStat[]) {
    const arr = m.get(r.region_slug) ?? [];
    // Summed per county_slug: two source spellings that slugify alike are ONE county —
    // they address one hub, so they must not look like two and halve the count.
    const prev = arr.find((x) => x.county_slug === r.county_slug);
    if (prev) prev.firm_count = Number(prev.firm_count) + Number(r.firm_count);
    else arr.push({ ...r, firm_count: Number(r.firm_count) });
    m.set(r.region_slug, arr);
  }
  // Array.from, not a bare Map iterator: this fleet's tsconfig targets below es2015 and
  // iterating a MapIterator directly is a TS2802 build error.
  for (const arr of Array.from(m.values())) arr.sort((a: RegionCountyStat, b: RegionCountyStat) => b.firm_count - a.firm_count);
  return m;
}

/** ITL1 regions with published inventory, canonical order. Non-ITL1 values dropped. */
async function ukItl1Regions(): Promise<RegionStat[]> {
  const { data, error } = await supabaseAdmin
    .from(REGION_STATS_VIEW)
    .select("region, region_slug, firm_count")
    .limit(5000);
  if (error) {
    console.error("ukItl1Regions error:", error.message);
    return [];
  }
  return ((data ?? []) as RegionStat[])
    .filter((r) => ITL1_SLUGS.has(r.region_slug) && Number(r.firm_count) > 0)
    .sort((a, b) => (ITL1_ORDER.get(a.region_slug) ?? 99) - (ITL1_ORDER.get(b.region_slug) ?? 99));
}

/**
 * The regions that GET A HUB — ITL1, with inventory, spanning >= 2 counties. This is
 * BOTH the route's param set and the sitemap's URL set: one function, so the two
 * expressions of the same gate cannot drift apart.
 */
export async function getUkRegions(): Promise<RegionStat[]> {
  const [regions, idx] = await Promise.all([ukItl1Regions(), regionCountyIndex()]);
  return regions.filter((r) => (idx.get(r.region_slug)?.length ?? 0) >= REGION_HUB_MIN_COUNTIES);
}

export interface RegionChip extends RegionStat {
  /** Site-relative path this chip links to. Always resolves 200-with-cards. */
  path: string;
}

/**
 * Chips for the homepage Browse-by-Area and the /uk index: every ITL1 region with
 * inventory, each pointing at whatever page actually serves it.
 *
 * A collapsed region's chip carries the COUNTY hub's OWN count, not the region's. They
 * can differ — uk_dentists has region London = 4,544 but county Greater London = 4,547,
 * three rows carrying the county with no region — and the number beside a link must be
 * the number the link opens.
 */
export async function getUkRegionChips(): Promise<RegionChip[]> {
  const [regions, idx] = await Promise.all([ukItl1Regions(), regionCountyIndex()]);
  const out: RegionChip[] = [];
  for (const r of regions) {
    const counties = idx.get(r.region_slug) ?? [];
    if (counties.length >= REGION_HUB_MIN_COUNTIES) {
      out.push({ ...r, path: `/uk/region/${r.region_slug}` });
      continue;
    }
    if (counties.length === 1) {
      const county = await getUkCountyBySlug(counties[0].county_slug);
      if (county) {
        out.push({
          region: r.region,
          region_slug: r.region_slug,
          firm_count: Number(county.firm_count),
          path: `/uk/${county.county_slug}`,
        });
      }
      continue;
    }
    // 0 counties: nothing that resolves to point at. Skipped, never linked (K119/K123).
  }
  return out;
}

/** One region hub. Null for a non-ITL1 slug, an empty region, or a single-county alias. */
export async function getUkRegionBySlug(regionSlug: string): Promise<RegionStat | null> {
  if (!ITL1_SLUGS.has(regionSlug)) return null;
  const [res, idx] = await Promise.all([
    supabaseAdmin
      .from(REGION_STATS_VIEW)
      .select("region, region_slug, firm_count")
      .eq("region_slug", regionSlug)
      .limit(1)
      .maybeSingle(),
    regionCountyIndex(),
  ]);
  if (res.error) {
    console.error("getUkRegionBySlug error:", res.error.message);
    return null;
  }
  const row = (res.data as RegionStat) ?? null;
  if (!row || Number(row.firm_count) <= 0) return null;
  if ((idx.get(regionSlug)?.length ?? 0) < REGION_HUB_MIN_COUNTIES) return null;
  return row;
}

/** County hubs inside one ITL1 region — the "browse by county" chips on a region hub. */
export async function getUkCountiesInRegion(regionSlug: string): Promise<RegionCountyStat[]> {
  if (!ITL1_SLUGS.has(regionSlug)) return [];
  const idx = await regionCountyIndex();
  return idx.get(regionSlug) ?? [];
}
/** All region hubs (for the sitemap). Same allowlist + inventory gate as the route. */
export async function getUkAllRegionHubs(): Promise<RegionStat[]> {
  return getUkRegions();
}


/**
 * Firms in one ITL1 region. DERIVED from this repo's own getUkFirmsByCounty (same
 * columns, same row mapping, same ordering, same cap) with the filter column swapped.
 */
export async function getUkFirmsByRegion(
  region: string,
  limit = FIRM_LIST_CAP
): Promise<UkFirm[]> {
  const { data, error } = await supabaseAdmin
    .from(UK_TABLE)
    .select(RAW_FIRM_COLS)
    .eq("is_published", true)
    .eq("region", region)
    .order("is_claimed", { ascending: false, nullsFirst: false })
    .order("business_name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getUkFirmsByRegion error:", error.message);
    return [];
  }
  return ((data ?? []) as RawFirmRow[]).map(mapFirm);
}
