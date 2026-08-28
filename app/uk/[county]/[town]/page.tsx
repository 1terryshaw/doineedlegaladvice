import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import {
  getUkCountyBySlug,
  getUkTownBySlug,
  getUkFirmsByTown,
  TOWN_PAGE_MIN_FIRMS,
} from "@/lib/uk-solicitors";
import {
  ukBreadcrumbSchema,
  ukCollectionPageSchema,
  ukPageMetadata,
} from "@/lib/uk-seo";
import UkListingCard from "@/components/uk/UkListingCard";
import RegulatorBadge, { dominantJurisdiction } from "@/components/uk/RegulatorBadge";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ county: string; town: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county, town } = await params;
  const townData = await getUkTownBySlug(county, town);
  if (!townData || Number(townData.firm_count) < TOWN_PAGE_MIN_FIRMS) {
    return { title: "Not Found" };
  }
  return ukPageMetadata({
    title: `Solicitors in ${townData.town}, ${townData.county} | DoINeedLegalAdvice`,
    description: `Find solicitors in ${townData.town}, ${townData.county}, UK. Browse ${Number(
      townData.firm_count
    ).toLocaleString("en-GB")} local law firms with contact details and registered addresses.`,
    path: `/uk/${county}/${town}`,
  });
}

export default async function UkTownPage({ params }: Props) {
  const { county, town } = await params;

  // Thin-content gate (BUILDSPEC §3): a town hub renders only at >= N firms. A
  // sub-threshold town 404s here — its firms still publish and appear on the county page.
  const [countyData, townData] = await Promise.all([
    getUkCountyBySlug(county),
    getUkTownBySlug(county, town),
  ]);
  if (!countyData || !townData || Number(townData.firm_count) < TOWN_PAGE_MIN_FIRMS) {
    notFound();
  }

  const firms = await getUkFirmsByTown(townData.county, townData.town);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukBreadcrumbSchema([
              { name: townData.county, path: `/uk/${county}` },
              { name: townData.town, path: `/uk/${county}/${town}` },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukCollectionPageSchema(
              `Solicitors in ${townData.town}`,
              `/uk/${county}/${town}`,
              Number(townData.firm_count),
              `${townData.town}, ${townData.county}`
            )
          ),
        }}
      />

      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/uk" className="hover:underline">UK Solicitors</Link>
        <span className="mx-2">/</span>
        <Link href={`/uk/${county}`} className="hover:underline">{townData.county}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{townData.town}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
        Solicitors in {townData.town}
      </h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {dominantJurisdiction(firms) && (
          <RegulatorBadge jurisdiction={dominantJurisdiction(firms)} variant="full" />
        )}
      </div>
      <p className="text-gray-600 mb-8">
        {Number(townData.firm_count).toLocaleString("en-GB")} solicitor firms in{" "}
        {townData.town}, {townData.county}.
      </p>

      {firms.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No firms to show yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {firms.map((firm) => (
            <UkListingCard key={firm.id} firm={firm} />
          ))}
        </div>
      )}
      {Number(townData.firm_count) > firms.length && (
        <p className="text-sm text-gray-400 mt-6">
          Showing {firms.length} of{" "}
          {Number(townData.firm_count).toLocaleString("en-GB")} firms in {townData.town}.
        </p>
      )}
    </div>
  );
}
