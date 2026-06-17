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
import { supabaseAdmin } from "@/lib/supabase";

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
