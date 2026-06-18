// lib/cost-models.ts — VERTICAL-AGNOSTIC Cost Estimator data layer (v2.3, sweep standard).
// Generalized from the dentist canary; drop-in across stamper repos. Vertical
// identity resolves from empire_verticals by LISTINGS_TABLE (Pattern A: async
// fetch + module cache + service role). Region dropdown uses a BUILT-IN canonical
// catalog (not verticalConfig.provinceLabels, which drifts across repos), filtered
// to the markets this vertical actually has cost_models for.
//
// Multi-market (us/ca/uk) + multi-currency (USD/CAD/GBP). cost_models keyed
// (vertical, market, service). region_modifiers is GLOBAL (queried by region only).
// Both tables are RLS service-role-only → server-side only. Never import into a
// "use client" module. supabaseAdmin comes from the LOCKED lib/supabase.ts.
//
// V14-FOLD: the only per-vertical customization is an OPTIONAL disclaimer
// extension (verticalConfig.costEstimator.disclaimerExtension) — empty by default,
// used by PARTIAL-scope verticals to add scope framing (out-of-pocket, cash-pay,
// event-only, etc.). Display-noun override lives in app/costs + components/CostEstimator.

import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

export type Market = "us" | "ca" | "uk";
export type Currency = "USD" | "CAD" | "GBP";

export const DEFAULT_MARKET: Market = "us";

const MARKET_CURRENCY: Record<Market, Currency> = { us: "USD", ca: "CAD", uk: "GBP" };
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "US$", CAD: "CA$", GBP: "£" };
const COUNTRY_LABEL: Record<Market, RegionOption["country"]> = {
  us: "United States",
  ca: "Canada",
  uk: "United Kingdom",
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[(currency as Currency)] ?? "$";
}
export function marketCurrencySymbol(m: Market): string {
  return CURRENCY_SYMBOL[MARKET_CURRENCY[m]] ?? "$";
}

// Built-in canonical region catalog (us + ca). UK regions come from
// region_modifiers when a vertical serves the uk market. Immune to per-repo
// provinceLabels schema drift.
const CA_PROVINCES: Array<[string, string]> = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
  ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"],
  ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"],
];
const US_STATES: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
const REGION_CATALOG: Record<string, { label: string; market: Market }> = {};
for (const [c, l] of CA_PROVINCES) REGION_CATALOG[c] = { label: l, market: "ca" };
for (const [c, l] of US_STATES) REGION_CATALOG[c] = { label: l, market: "us" };
const CA_SET = new Set(CA_PROVINCES.map(([c]) => c));

// --- Vertical identity (Pattern A: empire_verticals by listings_table) -------
export interface VerticalIdentity {
  vertical_slug: string;
  name_col: string;
  primary_domain: string | null;
  display_name: string | null;
}
let _identity: Promise<VerticalIdentity> | null = null;
export function getVerticalIdentity(): Promise<VerticalIdentity> {
  if (_identity) return _identity;
  _identity = (async () => {
    const { data, error } = await supabaseAdmin
      .from("empire_verticals")
      .select("vertical_slug, name_col, primary_domain, display_name")
      .eq("listings_table", LISTINGS_TABLE)
      .maybeSingle();
    if (error || !data) {
      console.error("getVerticalIdentity error:", error, "for", LISTINGS_TABLE);
      const slug = LISTINGS_TABLE.replace(/_listings$/, "");
      return { vertical_slug: slug, name_col: "business_name", primary_domain: null, display_name: null };
    }
    return {
      vertical_slug: data.vertical_slug,
      name_col: data.name_col || "business_name",
      primary_domain: data.primary_domain ?? null,
      display_name: data.display_name ?? null,
    };
  })();
  return _identity;
}

// --- Types -------------------------------------------------------------------
export interface CostService {
  service: string;
  service_label: string;
  base_low: number;
  base_high: number;
  unit: string;
  complexity_options: Record<string, number>;
  sort_order: number;
  notes: string | null;
}
export interface ComplexityOption { label: string; multiplier: number; }
export interface RegionResolution {
  region: string | null;
  region_name: string | null;
  region_slug: string | null;
  market: Market;
  currency: Currency;
  currency_symbol: string;
  multiplier: number;
  market_fallback: boolean;
}
export interface CostEstimate extends RegionResolution {
  service: string;
  service_label: string;
  complexity: string | null;
  complexity_multiplier: number;
  unit: string;
  low: number;
  high: number;
  n_pros_nearby: number;
  disclaimer: string;
}

export const COST_DISCLAIMER =
  "These ranges are estimates only. Actual cost varies by provider, scope of " +
  "service, and your specific situation. Always confirm pricing directly with the business.";

// V14-FOLD: optional per-vertical disclaimer extension. Default = "" (no
// extension). PARTIAL-scope verticals set verticalConfig.costEstimator
// .disclaimerExtension to add scope framing (e.g. "Estimates reflect typical
// out-of-pocket cash-pay pricing.").
const _ceCfg = (verticalConfig as { costEstimator?: { disclaimerExtension?: string } }).costEstimator;
export function fullDisclaimer(): string {
  const ext = _ceCfg?.disclaimerExtension?.trim();
  return ext ? `${COST_DISCLAIMER} ${ext}` : COST_DISCLAIMER;
}

// v2.2 magnitude-aware rounding: ≥$10 whole dollar; $1–10 nearest $0.50; <$1 nearest cent.
// Keeps per-sqft / per-linear-ft / sub-dollar trade pricing intact (round5 zeroed those).
function roundSmart(n: number): number {
  if (n <= 0) return 0;
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 2) / 2;
  return Math.round(n * 100) / 100;
}

export function complexityList(opts: Record<string, number>): ComplexityOption[] {
  return Object.entries(opts)
    .map(([label, multiplier]) => ({ label, multiplier: Number(multiplier) }))
    .sort((a, b) => a.multiplier - b.multiplier || a.label.localeCompare(b.label));
}
export function defaultComplexity(opts: Record<string, number>): string | null {
  const list = complexityList(opts);
  if (list.length === 0) return null;
  return list.reduce((best, o) =>
    Math.abs(o.multiplier - 1) < Math.abs(best.multiplier - 1) ? o : best
  ).label;
}

export async function getCostServices(market: Market = DEFAULT_MARKET): Promise<CostService[]> {
  const { vertical_slug } = await getVerticalIdentity();
  const { data, error } = await supabaseAdmin
    .from("cost_models")
    .select("service, service_label, base_low, base_high, unit, complexity_options, sort_order, notes")
    .eq("vertical", vertical_slug)
    .eq("market", market)
    .order("sort_order", { ascending: true });
  if (error) { console.error("getCostServices error:", error); return []; }
  return (data || []).map((r) => ({
    service: r.service,
    service_label: r.service_label,
    base_low: Number(r.base_low),
    base_high: Number(r.base_high),
    unit: r.unit,
    complexity_options: (r.complexity_options || {}) as Record<string, number>,
    sort_order: r.sort_order,
    notes: r.notes ?? null,
  }));
}

async function getServedMarkets(verticalSlug: string): Promise<Set<Market>> {
  const { data, error } = await supabaseAdmin
    .from("cost_models").select("market").eq("vertical", verticalSlug);
  if (error) { console.error("getServedMarkets error:", error); return new Set([DEFAULT_MARKET]); }
  const served = new Set<Market>();
  for (const r of data || []) served.add(r.market as Market);
  return served.size ? served : new Set<Market>([DEFAULT_MARKET]);
}

// The vertical's primary/default market (us > ca > uk), derived from what it
// actually has cost_models for. Used so CA-only (or uk-only) verticals don't
// default to an unseeded "us" market.
export async function getPrimaryMarket(): Promise<Market> {
  const { vertical_slug } = await getVerticalIdentity();
  const served = await getServedMarkets(vertical_slug);
  return served.has("us") ? "us" : served.has("ca") ? "ca" : served.has("uk") ? "uk" : DEFAULT_MARKET;
}

export interface RegionOption {
  slug: string;
  code: string;
  label: string;
  market: Market;
  country: "United States" | "Canada" | "United Kingdom";
}

export async function getRegionOptions(): Promise<RegionOption[]> {
  const { vertical_slug } = await getVerticalIdentity();
  const served = await getServedMarkets(vertical_slug);

  const na: RegionOption[] = Object.entries(REGION_CATALOG).map(([code, { label, market }]) => ({
    slug: code.toLowerCase(), code, label, market, country: COUNTRY_LABEL[market],
  }));

  let uk: RegionOption[] = [];
  if (served.has("uk")) {
    const { data, error } = await supabaseAdmin
      .from("region_modifiers").select("region, region_name").eq("market", "uk");
    if (error) console.error("getRegionOptions UK error:", error);
    else uk = (data || []).map((r) => ({
      slug: String(r.region).toLowerCase(),
      code: String(r.region).toUpperCase(),
      label: r.region_name || String(r.region),
      market: "uk" as Market,
      country: "United Kingdom" as RegionOption["country"],
    }));
  }

  na.sort((a, b) => a.label.localeCompare(b.label));
  uk.sort((a, b) => a.label.localeCompare(b.label));
  const out: RegionOption[] = [];
  if (served.has("us")) out.push(...na.filter((r) => r.market === "us"));
  if (served.has("ca")) out.push(...na.filter((r) => r.market === "ca"));
  out.push(...uk);
  return out;
}

export async function resolveRegion(
  regionCode: string | null,
  fallbackMarket: Market = DEFAULT_MARKET
): Promise<RegionResolution> {
  const code = regionCode ? regionCode.toUpperCase().trim() : "";
  const fallback = (): RegionResolution => ({
    region: null, region_name: null, region_slug: null,
    market: fallbackMarket, currency: MARKET_CURRENCY[fallbackMarket],
    currency_symbol: CURRENCY_SYMBOL[MARKET_CURRENCY[fallbackMarket]],
    multiplier: 1.0, market_fallback: true,
  });
  if (!code || !/^[A-Z]{2,3}$/.test(code)) return fallback();

  const { data } = await supabaseAdmin
    .from("region_modifiers")
    .select("region, region_name, multiplier, currency, market")
    .eq("region", code).limit(1);
  const row = data && data[0];
  if (row) {
    const market = (row.market as Market) || DEFAULT_MARKET;
    const currency = (row.currency as Currency) || MARKET_CURRENCY[market];
    return {
      region: code,
      region_name: row.region_name || REGION_CATALOG[code]?.label || code,
      region_slug: code.toLowerCase(),
      market, currency, currency_symbol: currencySymbol(currency),
      multiplier: Number(row.multiplier) || 1.0, market_fallback: false,
    };
  }

  const cat = REGION_CATALOG[code];
  if (!cat) return fallback();
  const currency = MARKET_CURRENCY[cat.market];
  return {
    region: code, region_name: cat.label, region_slug: code.toLowerCase(),
    market: cat.market, currency, currency_symbol: currencySymbol(currency),
    multiplier: 1.0, market_fallback: false,
  };
}

async function countProsInRegion(regionCode: string): Promise<number> {
  // v2.3: count by province_state only (no country filter). province_state codes
  // are country-unambiguous (no US-state/CA-province code overlap), and keying off
  // verticalConfig.supportedCountries broke verticals whose declared value drifted
  // from what the directory actually serves (e.g. moving: supportedCountries=["CA"]
  // but directory serves US too).
  const { count, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("province_state", regionCode.toUpperCase())
    .neq("is_published", false);
  if (error) { console.error("countProsInRegion error:", error); return 0; }
  return count || 0;
}

export async function estimateCost(input: {
  service: string; complexity?: string | null; region?: string | null;
}): Promise<CostEstimate | null> {
  const { vertical_slug } = await getVerticalIdentity();
  const primaryMarket = await getPrimaryMarket();
  const resolved = await resolveRegion(input.region ?? null, primaryMarket);
  const { data, error } = await supabaseAdmin
    .from("cost_models")
    .select("service, service_label, base_low, base_high, unit, complexity_options, market")
    .eq("vertical", vertical_slug).eq("market", resolved.market).eq("service", input.service)
    .maybeSingle();
  if (error) { console.error("estimateCost lookup error:", error); return null; }
  if (!data) return null;

  const opts = (data.complexity_options || {}) as Record<string, number>;
  const complexity = input.complexity && input.complexity in opts ? input.complexity : defaultComplexity(opts);
  const complexityMult = complexity && complexity in opts ? Number(opts[complexity]) : 1.0;
  const low = roundSmart(Number(data.base_low) * complexityMult * resolved.multiplier);
  const high = roundSmart(Number(data.base_high) * complexityMult * resolved.multiplier);
  const nPros = resolved.region ? await countProsInRegion(resolved.region) : 0;
  return {
    ...resolved,
    service: data.service, service_label: data.service_label,
    complexity, complexity_multiplier: complexityMult,
    unit: data.unit, low, high, n_pros_nearby: nPros, disclaimer: fullDisclaimer(),
  };
}
