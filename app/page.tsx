import type { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { getRegionByProvinceCode, countryOfProvinceCode, formatCount } from "@/lib/constants";
import { getRegionCounts } from "@/lib/directory-hub";
import TriageChat from "@/components/TriageChat";
import SearchBar from "@/components/SearchBar";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import FadeIn from "@/components/pizzazz/FadeIn";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { BrowseByArea } from "@/components/browse-by-area";
import { websiteSearchSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// TDL #788 \u2014 practice-area tiles were decorative (no practice-area data exists
// in legal_listings: listing_type \u2208 {attorney, lawyer, immigration, ''}). Replaced
// with Browse-by-State, sourced live from the region-count MV.
const COUNTRY_FLAG: Record<string, string> = { US: "\uD83C\uDDFA\uD83C\uDDF8", CA: "\uD83C\uDDE8\uD83C\uDDE6" };

export default async function HomePage() {
  // Top states/provinces by live row count for the Browse-by-State section.
  let topRegions: { slug: string; name: string; country: string; count: number }[] = [];
  try {
    const counts = await getRegionCounts();
    topRegions = counts
      .map((c) => {
        const r = getRegionByProvinceCode(c.province_state);
        if (!r) return null;
        return { slug: r.slug, name: r.name, country: countryOfProvinceCode(c.province_state), count: c.n };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  } catch (err) {
    console.error("HomePage getRegionCounts failed:", err);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSearchSchema()) }}
      />
      {/* SECTION 1: AI Triage Chat */}
      <section
        className="py-16 px-4 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${verticalConfig.heroGradientFrom}, ${verticalConfig.heroGradientVia}, ${verticalConfig.heroGradientTo})`,
        }}
      >
        {/* Floating dots pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute w-2 h-2 rounded-full bg-white/10 top-[15%] left-[10%]" />
          <div className="absolute w-3 h-3 rounded-full bg-white/[0.07] top-[30%] right-[15%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10 top-[60%] left-[25%]" />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-white/[0.06] top-[20%] right-[35%]" />
          <div className="absolute w-2 h-2 rounded-full bg-white/[0.08] top-[70%] right-[10%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10 top-[45%] left-[60%]" />
          <div className="absolute w-3 h-3 rounded-full bg-white/[0.05] top-[80%] left-[40%]" />
          <div className="absolute w-2 h-2 rounded-full bg-white/[0.08] top-[10%] left-[50%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/[0.07] top-[55%] right-[30%]" />
        </div>
        <div className="max-w-3xl mx-auto text-center text-white mb-8 relative">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-fade-up">
            Tell us your situation. We&apos;ll find the right lawyer.
          </h1>
          <p className="text-lg opacity-90 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Our AI triage helper asks a few quick questions, then matches you to the right type
            of attorney in your state. Information only &mdash; this is not legal advice and no
            attorney-client relationship is formed.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-6">
          <LegalDisclaimer />
        </div>

        <div className="max-w-3xl mx-auto">
          <TriageChat />
        </div>

        <div className="max-w-3xl mx-auto mt-6">
          <LegalDisclaimer />
        </div>
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Free to Search
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Verified Listings
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              No Spam
            </span>
          </div>
      </section>
      {/* SECTION 2: Browse Directory */}

      {/* Browse by State / Province (live counts \u2014 TDL #788) */}
      {topRegions.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Browse by State &amp; Province</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {topRegions.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="flex flex-col items-center p-5 bg-white border rounded-lg card-lift text-center"
                >
                  <span className="text-3xl mb-2">{COUNTRY_FLAG[r.country] || "\uD83D\uDCCD"}</span>
                  <span className="font-semibold text-gray-900 text-sm">{r.name}</span>
                  <span className="text-xs text-gray-500 mt-1">{formatCount(r.count)} lawyers</span>
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/directory"
                className="text-sm font-semibold"
                style={{ color: verticalConfig.primaryColor }}
              >
                Browse all states &amp; provinces &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}
      {/* Browse by Area (replaces LocationPicker — TDL #138) */}
      <FadeIn as="div" delay={100}>
        <BrowseByArea
          vertical="legal"
          accentTextClass="text-[#3B82F6] hover:text-[#306bca]"
        />
      </FadeIn>


      {/* Search */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Search the Directory</h2>
          <SearchBar variant="directory" />
        </div>
      </section>

      {/* FAQs */}
      {verticalConfig.faqs && verticalConfig.faqs.length > 0 && (
        <FadeIn as="section" delay={200} className="py-16 px-4 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {verticalConfig.faqs.map((faq, i) => (
                <details key={i} className="bg-white border rounded-lg p-5 group">
                  <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
                    {faq.question}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">&#9660;</span>
                  </summary>
                  <p className="mt-3 text-gray-600 text-sm">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </>
  );
}
