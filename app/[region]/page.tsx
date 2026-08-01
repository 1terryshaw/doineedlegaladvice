import { Metadata } from "next";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { getListings } from "@/lib/supabase";
import { getProvinceNameByCode, getRegionBySlug } from "@/lib/constants";
import { getListingsByProvincePaged, getRegionTotal, REGION_PAGE_SIZE } from "@/lib/directory-hub";
import { regionBreadcrumbSchema, regionCollectionPageSchema, localizeFaqs } from "@/lib/seo";
import FaqSection from "@/components/FaqSection";

const LEGAL_DISCLAIMER =
  "The information here is for informational purposes only and is not legal advice. Consult a licensed attorney in your jurisdiction about your specific situation.";
import ListingCard from "@/components/ListingCard";
import Pagination from "@/components/Pagination";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ page?: string }>;
}

// A slug that is a 2-letter province/state code (e.g. "ak", "on") is a paginated
// province page; anything else (e.g. "toronto") falls back to the legacy city
// listing. Regions are CA cities; province codes resolve via lib/provinces.ts.
function resolveProvince(slug: string): string | null {
  return getProvinceNameByCode(slug);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { region } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const provName = resolveProvince(region);
  if (provName) {
    const canonical = page > 1 ? `/${region}?page=${page}` : `/${region}`;
    const pageSuffix = page > 1 ? ` (Page ${page})` : "";
    return {
      title: `Lawyers in ${provName}${pageSuffix}`,
      description: `Find the best lawyers in ${provName}. Browse verified listings on ${verticalConfig.name}.`,
      alternates: { canonical },
    };
  }
  const city = getRegionBySlug(region);
  if (!city) return { title: "Not Found" };
  const label = (city as { name?: string; label?: string }).name || (city as { label?: string }).label || region;
  return {
    title: `Lawyers in ${label}`,
    description: `Find the best lawyers in ${label}.`,
    alternates: { canonical: `/${region}` },
  };
}

export default async function RegionPage({ params, searchParams }: Props) {
  const { region } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const provName = resolveProvince(region);

  // ── Province page (US state or CA province): paginated. ───────────────────
  if (provName) {
    const provCode = region.toUpperCase();
    const [total, listings] = await Promise.all([
      getRegionTotal(provCode),
      getListingsByProvincePaged(provCode, page),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / REGION_PAGE_SIZE));
    if (page > 1 && listings.length === 0) notFound();

    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionBreadcrumbSchema(region, provName)) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionCollectionPageSchema(region, provName, total)) }} />
        <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
          Lawyers in {provName}
        </h1>
        <div className="mb-4">
          <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
        </div>
        <p className="text-gray-600 mb-8">
          Browse {total.toLocaleString("en-US")} {total !== 1 ? "lawyers" : "lawyer"} in {provName}
          {totalPages > 1 ? ` — page ${page} of ${totalPages.toLocaleString("en-US")}` : ""}.
        </p>
        {listings.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            No lawyers in {provName} yet. Check back soon!
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            <Pagination currentPage={page} basePath={`/${region}`} totalPages={totalPages} />
          </>
        )}
        <FaqSection faqs={localizeFaqs(verticalConfig.faqs, provName)} disclaimer={LEGAL_DISCLAIMER} />
      </div>
    );
  }

  // ── Legacy city page (e.g. /toronto): unchanged behavior. ─────────────────
  const cityData = getRegionBySlug(region);
  if (!cityData) notFound();
  const label = (cityData as { name?: string; label?: string }).name || (cityData as { label?: string }).label || region;
  const listings = await getListings(region);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionBreadcrumbSchema(region, label)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionCollectionPageSchema(region, label, listings.length)) }} />
      <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
        Lawyers in {label}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {listings.length} {listings.length !== 1 ? "lawyers" : "lawyer"} in {label}.
      </p>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No lawyers in {label} yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      <FaqSection faqs={localizeFaqs(verticalConfig.faqs, label)} disclaimer={LEGAL_DISCLAIMER} />
    </div>
  );
}
