import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import {
  getUkRegionBySlug,
  getUkCountiesInRegion,
  getUkFirmsByRegion,
} from "@/lib/uk-solicitors";
import {
  ukBreadcrumbSchema,
  ukCollectionPageSchema,
  ukPageMetadata,
} from "@/lib/uk-seo";
import UkListingCard from "@/components/uk/UkListingCard";
import RegulatorBadge, { dominantJurisdiction } from "@/components/uk/RegulatorBadge";

// /uk/region/[region] — the ITL1 REGION tier (uk-region-tier-bba-day3).
//
// The peer of a CA province / US state. Sits ABOVE the ~190 ceremonial counties that
// /uk/[county] routes at, and mirrors that hub's shape one-for-one: same metadata
// helper, same BreadcrumbList + CollectionPage JSON-LD, same chip row, same card grid,
// same overflow line.
//
// `region` is a STATIC sibling of the `[county]` dynamic segment (alongside the
// existing claim/ directory/ privacy/ sitemap/), so Next resolves /uk/region/london here
// and never as county="region", town="london".
//
// A non-ITL1 or empty region 404s: getUkRegionBySlug allowlist-gates the slug and
// requires inventory, so a hub can never render an empty page.
// Mirrors this repo's own /uk/[county] segment config exactly: this repo does NOT run the
// /uk subtree on ISR, so the region hubs are dynamic here too and there is no prerender.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ region: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const regionData = await getUkRegionBySlug(region);
  if (!regionData) return { title: "Not Found" };
  return ukPageMetadata({
    title: `Solicitors in ${regionData.region} | DoINeedLegalAdvice`,
    description: `Find solicitors and law firms in ${regionData.region}, UK. Browse ${Number(
      regionData.firm_count
    ).toLocaleString("en-GB")} listings by county, with contact details and registered addresses.`,
    path: `/uk/region/${region}`,
  });
}

export default async function UkRegionPage({ params }: Props) {
  const { region } = await params;
  const regionData = await getUkRegionBySlug(region);
  if (!regionData) notFound();

  const [counties, firms] = await Promise.all([
    getUkCountiesInRegion(region),
    getUkFirmsByRegion(regionData.region),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukBreadcrumbSchema([{ name: regionData.region, path: `/uk/region/${region}` }])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukCollectionPageSchema(
              `Solicitors in ${regionData.region}`,
              `/uk/region/${region}`,
              Number(regionData.firm_count),
              regionData.region
            )
          ),
        }}
      />

      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/uk" className="hover:underline">UK Solicitors</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{regionData.region}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold" style={{ color: verticalConfig.primaryColor }}>
          Solicitors in {regionData.region}
        </h1>
        {dominantJurisdiction(firms) && (
          <RegulatorBadge jurisdiction={dominantJurisdiction(firms)} variant="full" />
        )}
      </div>
      <p className="text-gray-600 mb-8">
        {Number(regionData.firm_count).toLocaleString("en-GB")} solicitor firms in{" "}
        {regionData.region}, United Kingdom.
      </p>

      {counties.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">Browse by county</h2>
          <div className="flex flex-wrap gap-2">
            {counties.map((c) => (
              <Link
                key={c.county_slug}
                href={`/uk/${c.county_slug}`}
                className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm bg-white hover:shadow-md hover:border-gray-300 transition-all"
              >
                <span className="text-gray-800">{c.county}</span>
                <span className="text-xs text-gray-400">
                  {Number(c.firm_count).toLocaleString("en-GB")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Firms in {regionData.region}
        </h2>
        {firms.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No firms to show yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {firms.map((firm) => (
              <UkListingCard key={firm.id} firm={firm} />
            ))}
          </div>
        )}
        {Number(regionData.firm_count) > firms.length && (
          <p className="text-sm text-gray-400 mt-6">
            Showing {firms.length} of{" "}
            {Number(regionData.firm_count).toLocaleString("en-GB")} firms. Narrow by county
            above to see more.
          </p>
        )}
      </section>
    </div>
  );
}
