import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingsByCity } from "@/lib/supabase";
import { getCityBySlug, CITIES, PROVINCES } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import verticalConfig from "@/lib/vertical.config";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ region: string; city: string }>;
}

export async function generateStaticParams() {
  return CITIES.map((city) => ({
    region: city.province,
    city: city.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, city } = await params;
  const cityData = getCityBySlug(region, city);
  if (!cityData) return { title: "Not Found" };
  const provinceName = PROVINCES[cityData.province] ?? cityData.province;
  return {
    title: `Professionals in ${cityData.name}, ${provinceName}`,
    description: `Find professionals in ${cityData.name}, ${provinceName}. Browse our directory of trusted professionals.`,
    alternates: { canonical: `/${region}/${city}` },
  };
}

export default async function CityPage({ params }: Props) {
  const { region, city } = await params;
  const cityData = getCityBySlug(region, city);
  if (!cityData) notFound();

  const provinceName = PROVINCES[cityData.province] ?? cityData.province;
  const listings = await getListingsByCity(region, city);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">
        Professionals in {cityData.name}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {listings.length} {listings.length === 1 ? "professional" : "professionals"} in {cityData.name}, {provinceName}.
      </p>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No professionals in {cityData.name} yet. Check back soon!
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
