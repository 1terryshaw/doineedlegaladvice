import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { getFilteredListings , getFilteredListingsCount, getDirectoryRegions, type DirectoryRegion } from "@/lib/supabase";
import { LISTING_TYPES, REGIONS, formatCount } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import SearchBar from "@/components/SearchBar";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const metadata: Metadata = {
  title: `Browse Directory`,
  description: `Browse all ${verticalConfig.listingNounPlural} in the ${verticalConfig.name} directory.`,
  alternates: { canonical: "/directory" },
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; search?: string; city?: string; s?: string; listing_type?: string; region?: string }>;
}) {
  const params = await searchParams;
  const region = params.region || "";
  // FIX-EMPIRE-F7-SWEEP — when `region` is present, `city` is the
  // cascading-dropdown filter (slug). When no region, legacy `?city=`
  // stays a free-text name search alias.
  const cityFilter = region ? params.city || "" : "";
  const q = params.q || params.search || params.s || (region ? "" : params.city || "");
  const listing_type = params.listing_type || "";


  let runtimeRegions: DirectoryRegion[] = [];
  try {
    runtimeRegions = await getDirectoryRegions();
  } catch (err) {
    console.error("getDirectoryRegions failed; falling back:", err);
  }

  // Cards capped at 200; totalCount is the real DB count for honest display (#3).
  const [listings, totalCount] = await Promise.all([
    getFilteredListings({ q, listing_type, region, city: cityFilter }),
    getFilteredListingsCount({ q, listing_type, region, city: cityFilter }),
  ]);
  const hasFilters = !!(q || listing_type || region);

  const typeName = listing_type ? LISTING_TYPES.find((t) => t.slug === listing_type)?.name : null;
  const regionName = region ? REGIONS.find((r) => r.slug === region)?.name : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-6">
        <LegalDisclaimer />
      </div>
      <h1 className="text-3xl font-bold mb-2">All {verticalConfig.listingNounPlural}</h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`Browse ${verticalConfig.name} Directory`} />
      </div>

      <div className="mb-6">
        <SearchBar variant="directory" defaultQ={q} defaultType={listing_type} defaultRegion={region} defaultCity={cityFilter} regions={runtimeRegions.length > 0 ? runtimeRegions : undefined} />
      </div>

      <p className="text-gray-600 mb-4">
        {formatCount(totalCount)} {totalCount === 1 ? verticalConfig.listingNoun : verticalConfig.listingNounPlural}
        {hasFilters ? " matching your filters" : " in our directory"}.
      </p>

      {hasFilters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {q && (
            <Link
              href={`/directory?${new URLSearchParams({ ...(listing_type ? { listing_type } : {}), ...(region ? { region } : {}) }).toString()}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
            >
              Search: {q} <span aria-label="clear">&times;</span>
            </Link>
          )}
          {typeName && (
            <Link
              href={`/directory?${new URLSearchParams({ ...(q ? { q } : {}), ...(region ? { region } : {}) }).toString()}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
            >
              Type: {typeName} <span aria-label="clear">&times;</span>
            </Link>
          )}
          {regionName && (
            <Link
              href={`/directory?${new URLSearchParams({ ...(q ? { q } : {}), ...(listing_type ? { listing_type } : {}) }).toString()}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
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
      )}

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No {verticalConfig.listingNounPlural} found. Try adjusting your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
