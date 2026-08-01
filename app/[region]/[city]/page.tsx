import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingsByCity } from "@/lib/supabase";
import { getCityBySlug, CITIES, PROVINCES } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import verticalConfig from "@/lib/vertical.config";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import FaqSection from "@/components/FaqSection";
import { localizeFaqs } from "@/lib/seo";

const LEGAL_DISCLAIMER =
  "The information here is for informational purposes only and is not legal advice. Consult a licensed attorney in your jurisdiction about your specific situation.";
import { cityBreadcrumbSchema } from "@/lib/seo";
import CityFacetSummary from "@/components/CityFacetSummary";
import { getCityFacets } from "@/lib/facets";

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

// Display name for a city not in the curated CITIES constant (a DB-backed city
// that still renders): prefer the row's own city text, else title-case the slug
// (matching db962b6 obgyn/orthopedicsurgeon/pediatrician).
function deriveCityName(region: string, citySlug: string, rowCity?: string | null): string {
  if (rowCity && rowCity.trim()) return rowCity.trim();
  let s = citySlug;
  const suffix = `-${region.toLowerCase()}`;
  if (s.toLowerCase().endsWith(suffix)) s = s.slice(0, -suffix.length);
  return s
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, city } = await params;
  const cityData = getCityBySlug(region, city);
  const cityName = cityData?.name ?? deriveCityName(region, city);
  const provinceName = PROVINCES[region.toUpperCase()] ?? region;
  return {
    title: `Professionals in ${cityName}, ${provinceName}`,
    description: `Find professionals in ${cityName}, ${provinceName}. Browse our directory of trusted professionals.`,
    alternates: { canonical: `/${region}/${city}` },
  };
}

export default async function CityPage({ params }: Props) {
  const { region, city } = await params;
  const cityData = getCityBySlug(region, city);
  const listings = await getListingsByCity(region, city);
  // Zero-listing guard (matches db962b6 obgyn/orthopedicsurgeon/pediatrician +
  // 9aee83e dentist + 19db8f9 hvac): 404 whenever there are no listings, regardless
  // of CITIES membership. Was `if (!cityData) notFound()`, which 404'd DB-backed
  // cities absent from the curated CITIES list. Now a DB-backed city renders and
  // only a genuinely empty one 404s (no soft-200 shell).
  if (listings.length === 0) notFound();

  const cityName = cityData?.name ?? deriveCityName(region, city, listings[0]?.city);
  const provinceName = PROVINCES[region.toUpperCase()] ?? region;
  // Data-derived facet summary over our own enriched listings (renders nothing below
  // floor or when FACET_HELD in the experiment holdout).
  const facets = await getCityFacets(listings, "lawyer", region, city);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            cityBreadcrumbSchema(region, provinceName, city, cityName)
          ),
        }}
      />
      <h1 className="text-3xl font-bold mb-2">
        Professionals in {cityName}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {listings.length} {listings.length === 1 ? "professional" : "professionals"} in {cityName}, {provinceName}.
      </p>

      <CityFacetSummary facets={facets} cityName={cityName} noun="lawyers" />

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No professionals in {cityName} yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      <FaqSection faqs={localizeFaqs(verticalConfig.faqs, cityName)} disclaimer={LEGAL_DISCLAIMER} />
    </div>
  );
}
