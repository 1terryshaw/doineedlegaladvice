import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";
import ClaimOrAddHub from "@/components/ClaimOrAddHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim or Add Your Business",
};

export default function ClaimLandingPage() {
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">For business owners</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Claim or Add Your Business</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">Find your business in our directory to claim it, or add it if it is not listed yet. Your Google Business Profile can help you identify the right business and provide its Google Maps link.</p>
        </header>
        <ClaimOrAddHub />
      </div>
    </div>
  );
}
