import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "About",
  description: `About ${verticalConfig.name} — a legal-help navigator and directory for the US and Canada.`,
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-3">About {verticalConfig.name}</h1>
        <p className="text-lg text-gray-700">
          Find the right type of legal help, then a lawyer to contact. General information only — not legal advice.
        </p>
      </header>

      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">How it works</h2>
        {/* TDL #1407: the generative chat was discontinued 2026-11-01 (K443) — this page described it. */}
        <ol className="list-decimal pl-6 space-y-2">
          <li>You pick your state, province or territory, the kind of problem, and whether it is urgent.</li>
          <li>
            Our legal-help navigator shows the <em>type</em> of licensed professional who usually handles it,
            and official resources such as bar or law society referral services and legal aid. It runs in your
            browser: there is no free-text box and nothing you select is sent to us or to any AI service.
          </li>
          <li>We then link you to lawyers in our directory for your jurisdiction.</li>
        </ol>
      </section>

      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">What this site is not</h2>
        <p>
          We do <strong>not</strong> give legal advice, predict outcomes, or interpret your documents, and nothing on
          this site replaces a lawyer licensed where you live. Nothing you send us is privileged. We help you find the{" "}
          <em>type</em> of professional; only they can tell you what to do.
        </p>
      </section>

      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">Companion sites</h2>
        <p>
          Prefer to browse directly?{" "}
          <a
            href="https://doineedlegal.com"
            className="underline"
            style={{ color: verticalConfig.primaryColor }}
            rel="noopener"
          >
            DoINeedLegal.com
          </a>
          {" "}is our full directory. Looking for free or low-cost help?{" "}
          <a
            href="https://doineedlegalhelp.org"
            className="underline"
            style={{ color: verticalConfig.primaryColor }}
            rel="noopener"
          >
            DoINeedLegalHelp.org
          </a>
          {" "}covers nonprofits and legal aid.
        </p>
        <p>
          See our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </section>
    </div>
  );
}
