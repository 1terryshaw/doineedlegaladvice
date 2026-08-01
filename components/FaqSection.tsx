import { faqPageSchema, type FaqItem } from "@/lib/seo";

// Visible FAQ accordion + a sibling FAQPage JSON-LD script built from the SAME
// `faqs` array, so the schema is a 1:1 mirror of what the user sees (Google
// requires the FAQ content be visible on the page). Server component — no hooks.
//
// `faqs` is passed in already-localized (see localizeFaqs): the caller interpolates
// the page's location into the QUESTION only; this component never edits text.
//
// `disclaimer` (Wave-6): when set, a VISIBLE class-specific disclaimer line is
// rendered ABOVE the accordion (YMYL discipline for medical/legal verticals).
// When unset, behaviour is byte-identical to Wave 1-5 (no disclaimer).
export default function FaqSection({
  faqs,
  heading = "Frequently Asked Questions",
  className = "py-16 px-4 bg-gray-50",
  disclaimer,
}: {
  faqs: FaqItem[];
  heading?: string;
  className?: string;
  disclaimer?: string;
}) {
  if (!faqs || faqs.length === 0) return null;
  return (
    <section className={className}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">{heading}</h2>
        {disclaimer ? (
          <p className="mb-6 text-sm text-gray-600 italic text-center border-l-4 border-gray-300 bg-white/60 px-4 py-3 rounded">
            {disclaimer}
          </p>
        ) : null}
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="bg-white border rounded-lg">
              <summary className="cursor-pointer p-4 font-semibold text-gray-900 hover:bg-gray-50">
                {faq.question}
              </summary>
              <p className="px-4 pb-4 text-gray-600 text-sm leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
