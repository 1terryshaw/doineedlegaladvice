import { Metadata } from "next";
import Link from "next/link";
import { ukPageMetadata } from "@/lib/uk-seo";

export const dynamic = "force-static";

const UPDATED = "16 June 2026";
const CONTROLLER = "Smart Website Management";
const PRIVACY_EMAIL = "privacy@doineedlegaladvice.com";
const POSTAL = "Smart Website Management, 403 Kingston Rd, Toronto, ON M4L 1V1, Canada";

export const metadata: Metadata = ukPageMetadata({
  title: "UK Privacy & Marketing Notice | DoINeedLegalAdvice",
  description:
    "How DoINeedLegalAdvice (operated by Smart Website Management) handles UK business contact data, the lawful basis for B2B email under PECR and UK GDPR, and how to opt out.",
  path: "/uk/privacy",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function UkPrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <Link href="/uk" className="hover:underline">UK Solicitors</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">Privacy &amp; Marketing</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900">UK Privacy &amp; Marketing Notice</h1>
      <p className="text-sm text-gray-400 mt-1">Last updated: {UPDATED}</p>

      <Section title="Who we are">
        <p>
          The DoINeedLegalAdvice UK directory (doineedlegaladvice.com/uk) is operated by{" "}
          {CONTROLLER}, which is the data controller for the processing described here. You can
          reach us at <a className="text-teal-700 hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> or by
          post at {POSTAL}.
        </p>
      </Section>

      <Section title="What data we hold and where it comes from">
        <p>
          Our UK directory is built from <strong>publicly available information</strong>: the UK
          Companies House register (company name, number, type, registered office address, SIC
          codes), the public roster of the Law Society of Northern Ireland, and, where we have
          matched a firm to its own website, business contact details published on that website
          (such as a business email address, a business phone number, and the website URL). We hold
          this for <strong>solicitor firms — incorporated companies, LLPs and PLCs, plus listed
          practices</strong> — i.e. organisations, not individuals.
        </p>
      </Section>

      <Section title="Lawful basis for B2B marketing email (PECR & UK GDPR)">
        <p>
          Under the Privacy and Electronic Communications Regulations (PECR), marketing email to{" "}
          <strong>corporate subscribers</strong> (limited companies, LLPs and PLCs) does not require
          prior consent. We send relevant business-to-business email <strong>only to corporate-
          subscriber firms</strong> — and exclude sole practitioners and unincorporated practices
          from that channel — provided we identify ourselves and offer a working opt-out, which we
          do in every message.
        </p>
        <p>
          Where a business contact address happens to identify an individual (for example a named
          partner&apos;s address), that address is personal data under UK GDPR. Our lawful basis for
          processing it is <strong>legitimate interests</strong> (Article 6(1)(f)) — promoting a
          relevant professional directory service to a business — which we have assessed and balanced
          against the rights of the people concerned. Wherever possible we use a firm&apos;s{" "}
          <strong>role inbox</strong> (such as info@ or enquiries@) rather than a named individual.
        </p>
      </Section>

      <Section title="How we use the data">
        <p>
          To list firms in the public directory and to send occasional, relevant B2B email inviting a
          firm to claim and manage its free listing. We do not sell your data. We do not use it for
          automated decision-making.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Object</strong> to our processing for direct marketing — we will stop immediately.</li>
          <li><strong>Opt out</strong> of email at any time (see below).</li>
          <li><strong>Access</strong> the data we hold about you, or ask us to <strong>correct</strong> or <strong>erase</strong> it.</li>
          <li>Complain to the UK Information Commissioner&apos;s Office (ICO) at ico.org.uk.</li>
        </ul>
      </Section>

      <Section title="How to opt out / unsubscribe">
        <p>
          Every marketing email contains a one-click unsubscribe link and an unsubscribe header, and
          we honour opt-outs promptly. You can also email{" "}
          <a className="text-teal-700 hover:underline" href={`mailto:${PRIVACY_EMAIL}?subject=Unsubscribe`}>{PRIVACY_EMAIL}</a>{" "}
          asking us to remove your address or your firm&apos;s listing, and we will suppress it from
          all future contact.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep directory and suppression data for as long as the directory operates; opt-out
          (suppression) records are kept indefinitely so we can continue to honour your opt-out.
        </p>
      </Section>

      <p className="mt-10 text-sm">
        <Link href="/uk" className="text-teal-700 hover:underline">← Back to UK Solicitors</Link>
      </p>
    </div>
  );
}
