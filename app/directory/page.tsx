import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { getDirectoryRegions, type DirectoryRegion } from "@/lib/supabase";
import {
  getFilteredListingsPaged,
  getRegionCounts,
  REGION_PAGE_SIZE,
} from "@/lib/directory-hub";
import {
  LISTING_TYPES,
  getRegionBySlug,
  getRegionByProvinceCode,
  countryOfProvinceCode,
} from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import RegionHub, { type HubSection, type HubRegion } from "@/components/RegionHub";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { getUkAllTownHubs, getUkCounties } from "@/lib/uk-solicitors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function getUkSearchOptions() {
  try {
    const [counties, towns] = await Promise.all([
      getUkCounties(),
      getUkAllTownHubs(),
    ]);

    return {
      ukCounties: counties.map((county) => ({
        slug: county.county_slug,
        name: county.county,
        count: county.firm_count,
      })),
      ukTowns: towns.map((town) => ({
        countySlug: town.county_slug,
        slug: town.town_slug,
        name: town.town,
      })),
    };
  } catch (error) {
    console.error("getUkSearchOptions failed; UK cascade omitted:", error);
    return { ukCounties: [], ukTowns: [] };
  }
}

export const metadata: Metadata = {
  title: "Find a Lawyer",
  description: `Browse lawyers near you in the ${verticalConfig.name} directory.`,
  alternates: { canonical: "/directory" },
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; search?: string; city?: string; s?: string; listing_type?: string; region?: string; page?: string }>;
}) {
  const params = await searchParams;
  const region = params.region || "";
  const cityFilter = region ? params.city || "" : "";
  const q = params.q || params.search || params.s || (region ? "" : params.city || "");
  const listingType = params.listing_type || "";
  const hasFilters = !!(q || listingType || region || cityFilter);

  let runtimeRegions: DirectoryRegion[] = [];
  try {
    runtimeRegions = await getDirectoryRegions();
  } catch (err) {
    console.error("getDirectoryRegions failed; falling back:", err);
  }
  const ukOptions = await getUkSearchOptions();

  // ── Default view (no filters): browse-by-region hub. ──────────────────────
  if (!hasFilters) {
    const counts = await getRegionCounts();
    const ca: HubRegion[] = [];
    const us: HubRegion[] = [];
    for (const c of counts) {
      const r = getRegionByProvinceCode(c.province_state);
      if (!r) continue;
      const entry: HubRegion = { slug: r.slug, name: r.name ?? r.province, count: c.n };
      (countryOfProvinceCode(c.province_state) === "CA" ? ca : us).push(entry);
    }
    const byName = (a: HubRegion, b: HubRegion) => a.name.localeCompare(b.name);
    ca.sort(byName);
    us.sort(byName);
    const uk: HubRegion[] = ukOptions.ukCounties
      .map((county) => ({
        slug: county.slug,
        name: county.name,
        count: county.count ?? 0,
      }))
      .sort(byName);
    const sections: HubSection[] = [];
    if (us.length) sections.push({ country: "US", label: "🇺🇸 United States", regions: us });
    if (ca.length) sections.push({ country: "CA", label: "🇨🇦 Canada", regions: ca });
    if (uk.length) {
      sections.push({
        country: "UK",
        label: "🇬🇧 United Kingdom",
        regions: uk,
        hrefPrefix: "/uk",
      });
    }

    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
          Find a Lawyer
        </h1>
        <div className="mb-4">
          <ShareButtons variant="compact" title={`Browse ${verticalConfig.name} Directory`} />
        </div>
        <div className="mb-6">
          <SearchBar
            variant="directory"
            regions={runtimeRegions.length > 0 ? runtimeRegions : undefined}
            ukCounties={ukOptions.ukCounties}
            ukTowns={ukOptions.ukTowns}
          />
        </div>
        {sections.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No regions available yet. Check back soon!</p>
        ) : (
          <RegionHub sections={sections} />
        )}
      </div>
    );
  }

  // ── Filtered view: paginated results. ─────────────────────────────────────
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const fetched = await getFilteredListingsPaged({
    q,
    listing_type: listingType,
    region,
    city: cityFilter,
    page,
    perPage: REGION_PAGE_SIZE,
  });
  const hasNext = fetched.length > REGION_PAGE_SIZE;
  const listings = hasNext ? fetched.slice(0, REGION_PAGE_SIZE) : fetched;

  const typeName = listingType ? LISTING_TYPES.find((t) => t.slug === listingType)?.name : null;
  // HARDENED (Batch 4): use getRegionBySlug (constants.REGIONS) — shape-agnostic
  // across config-map AND explicit-array repos, and works when vertical.config
  // has no `regions` field. REGIONS.name is pre-normalized (name||label).
  const regionMatch = getRegionBySlug(region) as
    | { name?: string; label?: string }
    | null;
  const regionName = region
    ? regionMatch?.name || regionMatch?.label || getRegionByProvinceCode(region)?.name
    : null;

  const pageParams: Record<string, string> = {};
  if (q) pageParams.q = q;
  if (listingType) pageParams.listing_type = listingType;
  if (region) pageParams.region = region;
  if (cityFilter) pageParams.city = cityFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
        Find a Lawyer
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`Browse ${verticalConfig.name} Directory`} />
      </div>

      <div className="mb-6">
        <SearchBar
          variant="directory"
          defaultQ={q}
          defaultType={listingType}
          defaultRegion={region}
          defaultCity={cityFilter}
          regions={runtimeRegions.length > 0 ? runtimeRegions : undefined}
          ukCounties={ukOptions.ukCounties}
          ukTowns={ukOptions.ukTowns}
        />
      </div>


      <div className="flex flex-wrap gap-2 mb-6">
        {q && (
          <Link
            href={`/directory?${new URLSearchParams({ ...(listingType ? { listing_type: listingType } : {}), ...(region ? { region } : {}) }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Search: {q} <span aria-label="clear">&times;</span>
          </Link>
        )}
        {typeName && (
          <Link
            href={`/directory?${new URLSearchParams({ ...(q ? { q } : {}), ...(region ? { region } : {}) }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Specialty: {typeName} <span aria-label="clear">&times;</span>
          </Link>
        )}
        {regionName && (
          <Link
            href={`/directory?${new URLSearchParams({ ...(q ? { q } : {}), ...(listingType ? { listing_type: listingType } : {}) }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Region: {regionName} <span aria-label="clear">&times;</span>
          </Link>
        )}
        <Link
          href="/directory"
          className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200"
        >
          Clear all
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No lawyers found matching your criteria. Try broadening your search.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination currentPage={page} basePath="/directory" hasNext={hasNext} params={pageParams} />
        </>
      )}
    </div>
  );
}
