import { Metadata } from "next";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { getListings } from "@/lib/supabase";
import { getRegionBySlug, REGIONS } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import ShareButtons from "@/components/pizzazz/ShareButtons";

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
  };
}

export default async function RegionPage({ params }: Props) {
  const { region } = await params;
  const regionData = getRegionBySlug(region);
  if (!regionData) notFound();

  const listings = await getListings(region);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">
        {verticalConfig.listingNounPlural} in {regionData.name}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {listings.length} {listings.length === 1 ? verticalConfig.listingNoun : verticalConfig.listingNounPlural} in {regionData.name}, {regionData.province}.
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
