import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { REGIONS, LISTING_TYPES } from "@/lib/constants";
import AIChatAdvisor from "@/components/AIChatAdvisor";
import SearchBar from "@/components/SearchBar";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import FadeIn from "@/components/pizzazz/FadeIn";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { CANONICAL_CITIES, PROVINCES as PROVINCES_LIST } from "@/lib/shared/cities";
import { HeroSearch } from "@/components/hero-search";
import { BrowseByArea } from "@/components/browse-by-area";

export const dynamic = "force-dynamic";

const PRACTICE_AREA_ICONS: Record<string, string> = {
  "family-lawyer": "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67",
  "real-estate-lawyer": "\uD83C\uDFE0",
  "immigration-lawyer": "\uD83C\uDF0D",
  "criminal-lawyer": "\u2696\uFE0F",
  "personal-injury-lawyer": "\uD83C\uDFE5",
  "business-lawyer": "\uD83D\uDCBC",
  "employment-lawyer": "\uD83D\uDC54",
  "estate-lawyer": "\uD83D\uDCDC",
  "tax-lawyer": "\uD83E\uDDFE",
  "intellectual-property-lawyer": "\uD83D\uDCA1",
};

export default async function HomePage() {
  return (
    <>
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
            Describe Your Legal Situation — Get Free Guidance
          </h1>
          <p className="text-lg opacity-90 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Our AI assistant will help you understand your options and find the right type of
            lawyer. This is not legal advice.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-6">
          <LegalDisclaimer />
        </div>

        <div className="max-w-3xl mx-auto">
          <AIChatAdvisor />
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

      {/* HeroSearch band (replaces LocationPicker top-of-page — TDL #138) */}
      <HeroSearch
        vertical="fla"
        provinces={PROVINCES_LIST}
        cities={CANONICAL_CITIES}
        accentClass="bg-[#3B82F6] hover:bg-[#306bca]"
      />

      {/* SECTION 2: Browse Directory */}

      {/* Browse by Practice Area */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Browse by Practice Area</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {LISTING_TYPES.map((type) => (
              <Link
                key={type.slug}
                href="/directory"
                className="flex flex-col items-center p-5 bg-white border rounded-lg card-lift text-center"
              >
                <span className="text-3xl mb-2">{PRACTICE_AREA_ICONS[type.slug] || "\u2696\uFE0F"}</span>
                <span className="font-semibold text-gray-900 text-sm">{type.name}</span>
                <span className="text-xs text-gray-500 mt-1">{type.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {/* Browse by Area (replaces LocationPicker — TDL #138) */}
      <FadeIn as="div" delay={100}>
        <BrowseByArea
          vertical="fla"
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
