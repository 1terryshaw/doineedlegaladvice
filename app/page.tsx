import type { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";
import TriageChat from "@/components/TriageChat";
import SearchBar from "@/components/SearchBar";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import FadeIn from "@/components/pizzazz/FadeIn";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { websiteSearchSchema, faqPageSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// TDL #800 \u2014 homepage collapsed to a single search surface: the practice-area
// dropdown (no practice-area data) and the redundant Browse-by-State / Browse-by-Area
// sections were removed, leaving hero \u2192 triage \u2192 Search the Directory \u2192 FAQ.
export default async function HomePage() {
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
              Compiled from Public Records
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              No Spam
            </span>
          </div>
      </section>
      {/* SECTION 2: Search the Directory — single geographic entry point (TDL #800) */}

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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema([...verticalConfig.faqs])) }}
          />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            <p className="mb-6 text-sm text-gray-600 italic text-center border-l-4 border-gray-300 bg-white/60 px-4 py-3 rounded">
              The information here is for informational purposes only and is not legal advice. Consult a licensed attorney in your jurisdiction about your specific situation.
            </p>
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
