import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "About",
  description: `About ${verticalConfig.name} — AI-driven legal triage.`,
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-3">About {verticalConfig.name}</h1>
        <p className="text-lg text-gray-700">
          Triage first. Then a directory match.
        </p>
      </header>

      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">How it works</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>You describe your situation in plain language.</li>
          <li>
            Our AI helper asks two or three clarifying questions to identify the issue category,
            your state, and whether there&apos;s any time pressure.
          </li>
          <li>
            It tells you what <em>kind</em> of attorney you should look for &mdash; immigration,
            family, criminal, employment, etc. &mdash; and what to expect from the first
            conversation with one.
          </li>
          <li>
            We then surface attorneys in our directory matching that practice area and your
            state.
          </li>
        </ol>
      </section>

      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">What the AI is not</h2>
        <p>
          Our AI does <strong>not</strong> give you advice about what to do, predict outcomes,
          interpret your specific contracts or court documents, or replace an attorney licensed
          in your jurisdiction. Communications with our AI are <strong>not</strong>{" "}
          attorney-client privileged. We tell you the <em>type</em> of attorney to find; only
          they can tell you what to do.
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
