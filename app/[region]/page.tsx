import { Metadata } from "next";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { getListings, getFilteredListingsCount } from "@/lib/supabase";
import { getRegionBySlug, REGIONS, formatCount } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { regionBreadcrumbSchema, regionCollectionPageSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ region: string }>;
}

export async function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const regionData = getRegionBySlug(region);
  if (!regionData) return { title: "Not Found" };
  return {
    title: `${verticalConfig.listingNounPlural} in ${regionData.name}`,
    description: `Find the best ${verticalConfig.listingNounPlural} in ${regionData.name}, ${regionData.province}.`,
    alternates: { canonical: `/${region}` },
  };
}

export default async function RegionPage({ params }: Props) {
  const { region } = await params;
  const regionData = getRegionBySlug(region);
  if (!regionData) notFound();

  // Cards capped at 200 (getListings); totalCount is the real DB count so the
  // page shows "Browse 187,864 lawyers", not the rendered-array length (#3).
  const [listings, totalCount] = await Promise.all([
    getListings(region),
    getFilteredListingsCount({ region }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionBreadcrumbSchema(region, regionData.name)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionCollectionPageSchema(region, regionData.name, totalCount)) }} />
      <h1 className="text-3xl font-bold mb-2">
        {verticalConfig.listingNounPlural} in {regionData.name}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {formatCount(totalCount)} {totalCount === 1 ? verticalConfig.listingNoun : verticalConfig.listingNounPlural} in {regionData.name}, {regionData.province}.
      </p>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No {verticalConfig.listingNounPlural} in {regionData.name} yet. Check back soon!
        </p>
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
