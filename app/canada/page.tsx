// TDL #1407 (legal-fla-retirement-v1, CEO R4): the Canada landing. FreeLawyerAdvice.ca was retired
// on 2026-11-01; its home + static pages 301 here. Copy carries the #1402 FLA fixes: no "free legal
// advice" promise, general information only, the deterministic navigator (no chat, no free text).
import type { Metadata } from "next";
import Link from "next/link";
import LegalNavigator from "@/components/LegalNavigator";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { CA_SERVED_ON_DINLA } from "@/lib/legal-consolidation";
import { CA_PROVINCES } from "@/lib/legal-navigator-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Find a Lawyer or Legal Help in Canada",
  description:
    "Find the right type of lawyer or legal help in your province or territory: official resources such as law society referral services and legal aid, and a directory of Canadian lawyers. General information only — not legal advice.",
  alternates: { canonical: "/canada" },
};

// Province/territory hubs with published listings (NU and YT have none yet, so no hub link).
const HUB_CODES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "ON", "PE", "QC", "SK"];

export default function CanadaPage() {
  const hubs = CA_PROVINCES.filter((p) => HUB_CODES.includes(p.code));
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <header className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold">Find the Right Type of Lawyer or Legal Help in Canada</h1>
        <p className="text-lg text-gray-700">
          Tell us your province and the kind of problem. We&apos;ll show you the type of licensed professional who
          usually handles it, official resources like your law society&apos;s referral service and legal aid, and
          lawyers to contact. General information only &mdash; not legal advice.
        </p>
        <p className="text-sm text-gray-600" data-testid="fla-moved-note">
          FreeLawyerAdvice.ca is now part of DoINeedLegalAdvice.com. Canadian listings, claimed profiles and owner
          logins moved here unchanged.
        </p>
      </header>

      <LegalDisclaimer />

      <LegalNavigator site="dinla" caServedOnDinla={CA_SERVED_ON_DINLA} />

      <section aria-labelledby="ca-hubs">
        <h2 id="ca-hubs" className="text-2xl font-bold mb-4 text-center">Browse lawyers by province or territory</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {hubs.map((p) => (
            <li key={p.code}>
              <Link href={`/${p.code.toLowerCase()}`} className="block p-4 border rounded-lg bg-white hover:bg-gray-50 text-center font-medium">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-sm text-gray-600 space-y-2">
        <p>
          Lawyers: if you have a listing, you can claim or manage it from its page, or{" "}
          <Link href="/owner/login" className="underline">sign in to your owner dashboard</Link> with the same email
          you used on FreeLawyerAdvice.ca.
        </p>
        <p>
          <Link href="/privacy" className="underline">Privacy Policy</Link> (including information for visitors in Canada)
          &middot; <Link href="/terms" className="underline">Terms</Link>
        </p>
      </section>
    </div>
  );
}
