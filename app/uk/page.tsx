import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { getUkCounties } from "@/lib/uk-solicitors";
import { ukBreadcrumbSchema, ukCollectionPageSchema, ukPageMetadata } from "@/lib/uk-seo";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TITLE = "Find a Solicitor in the UK | DoINeedLegalAdvice";
const DESCRIPTION =
  "Browse a directory of UK solicitors and law firms by county and town. Find contact details, registered addresses, regulator, and claim your firm's listing for free.";

export const metadata: Metadata = ukPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/uk",
});

export default async function UkIndexPage() {
  const counties = await getUkCounties();
  const totalFirms = counties.reduce((sum, c) => sum + Number(c.firm_count), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ukBreadcrumbSchema([])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            ukCollectionPageSchema("UK Solicitors", "/uk", totalFirms, "the United Kingdom")
          ),
        }}
      />

      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">UK Solicitors</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2" style={{ color: verticalConfig.primaryColor }}>
        Find a Solicitor in the UK
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title="UK Solicitors — DoINeedLegalAdvice" />
      </div>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Browse {totalFirms.toLocaleString("en-GB")} solicitor firms across{" "}
        {counties.length} UK counties, regulated by the SRA (England &amp; Wales), the Law
        Society of Scotland, or the Law Society of Northern Ireland. Choose a county to find
        solicitors near you, see registered details, and connect directly.
      </p>

      {counties.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          UK listings are coming soon. Check back shortly.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {counties.map((c) => (
            <Link
              key={c.county_slug}
              href={`/uk/${c.county_slug}`}
              className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white hover:shadow-md hover:border-gray-300 transition-all"
            >
              <span className="font-medium text-gray-900">{c.county}</span>
              <span className="text-xs text-gray-500">
                {Number(c.firm_count).toLocaleString("en-GB")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
