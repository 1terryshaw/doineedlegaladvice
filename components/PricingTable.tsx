"use client";

import { useState } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { PRICING_TIERS } from "@/lib/pricing";
import { useOwnerAuth } from "@/lib/useOwnerAuth";

export default function PricingTable() {
  const [annual, setAnnual] = useState(false);
  const { authenticated, slug, tier: currentTier } = useOwnerAuth();
  const upgradeHref = authenticated && slug ? `/directory/${slug}?upgrade=true` : "/claim";
  const upgradeLabel = authenticated && slug ? "Upgrade Now" : "Claim Your Listing to Upgrade";

  return (
    <div>
      {/* Monthly / Annual toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !annual ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              annual ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
            onClick={() => setAnnual(true)}
          >
            Annual <span className="text-green-600 text-xs font-semibold">Save 17%</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {/* Free Claimed Tier */}
        <div className="border rounded-xl p-8 flex flex-col bg-white">
          <h3 className="text-xl font-bold">Claimed</h3>
          <div className="mt-4">
            <span className="text-4xl font-bold">Free</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Claim and manage your listing</p>
          <ul className="mt-6 space-y-3 flex-1">
            {[
              "Edit your info & details",
              "Upload up to 3 photos",
              "Verification badge",
              "Mini-site URL on directory",
              "Receive inquiries",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {authenticated && slug && (currentTier === "claimed" || currentTier === "seed" || currentTier === "free" || !currentTier) ? (
            <div
              className="mt-8 w-full py-3 rounded-lg text-center font-medium border-2 bg-gray-50 text-gray-500 cursor-default"
              style={{ borderColor: "#d1d5db" }}
            >
              ✓ Your Current Plan
            </div>
          ) : (
            <Link
              href="/claim"
              className="mt-8 w-full py-3 rounded-lg text-center font-medium border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: verticalConfig.primaryColor, color: verticalConfig.primaryColor }}
            >
              Claim Now
            </Link>
          )}
        </div>

        {/* Paid tiers */}
        {PRICING_TIERS.map((tier) => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice;
          const interval = annual ? "year" : "month";

          return (
            <div
              key={tier.slug}
              className={`border rounded-xl p-8 flex flex-col ${
                tier.highlighted ? "ring-2 shadow-lg relative" : ""
              }`}
              style={tier.highlighted ? { borderColor: verticalConfig.primaryColor } : {}}
            >
              {tier.highlighted && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ backgroundColor: verticalConfig.primaryColor }}
                >
                  Recommended
                </span>
              )}
              <h3 className="text-xl font-bold">{tier.name}</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">${price}</span>
                <span className="text-gray-500">/{interval}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5">&#10003;</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {authenticated && currentTier === tier.slug ? (
                <div
                  className="mt-8 w-full py-3 rounded-lg text-center font-medium border-2 bg-gray-50 text-gray-500 cursor-default"
                  style={{ borderColor: "#d1d5db" }}
                >
                  ✓ Your Current Plan
                </div>
              ) : (
                <Link
                  href={upgradeHref}
                  className="mt-8 w-full py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity text-center"
                  style={{ backgroundColor: tier.highlighted ? verticalConfig.primaryColor : "#374151" }}
                >
                  {upgradeLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
