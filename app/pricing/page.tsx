import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";
import PricingTable from "@/components/PricingTable";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Choose the right plan for your ${verticalConfig.listingNoun} on ${verticalConfig.name}.`,
  // Self-canonical (static-canonical-fan-v1, donor stamper-donor-v16.9). This page set
  // no `alternates`, so the canonical was inferred from whatever URL a crawler arrived
  // on, while the page IS advertised in the sitemap. Relative, per the repo idiom:
  // app/layout.tsx metadataBase (lib/seo.ts SITE_URL) resolves it to this site's origin.
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Pricing Plans</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Choose the plan that best fits your business. Upgrade or downgrade at any time.
        </p>
      </div>
      <PricingTable />
    </div>
  );
}
