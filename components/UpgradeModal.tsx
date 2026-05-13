// pricing-version: 2026-05-12-usd-v2
"use client";

import { useState, useEffect } from "react";
import { getTierBySlug } from "@/lib/pricing";
import { useSearchParams, useRouter } from "next/navigation";

type BillingCycle = "monthly" | "annual";

type Tier = {
  id: "lead_boost" | "website" | "growth";
  name: string;
  tagline: string;
  monthlyPriceEnv: string;
  annualPriceEnv: string;
  features: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "lead_boost",
    name: "Leads Boost",
    tagline: "Leads forwarded to you via email + SMS within seconds",
    monthlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_REVIEWS_MONTHLY",
    annualPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_REVIEWS_ANNUAL",
    features: [
      "Leads forwarded via email + SMS within seconds",
      "Full Google review display on your listing",
      "Priority placement in search results",
      "Cross-referral visibility across our network",
      "AI-powered review response drafts",
      "Automatic review request sequence",
      "No contracts, cancel anytime",
    ],
  },
  {
    id: "website",
    name: "Website",
    tagline: "Custom SiteForge website or drop-in landing page",
    monthlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_WEBSITE_MONTHLY",
    annualPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_WEBSITE_ANNUAL",
    features: [
      "Everything in Leads Boost",
      "Full custom website built from your content",
      "Deployed in 7 days",
      "Or drop-in landing page for existing sites",
    ],
    highlight: true,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Website + monthly content + review management",
    monthlyPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_GROWTH_MONTHLY",
    annualPriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_GROWTH_ANNUAL",
    features: [
      "Everything in Website tier",
      "Monthly blog post published for you",
      "Review response drafts",
      "Priority support",
    ],
  },
];

type Props = {
  listingSlug: string;
  priceIds: {
    lead_boost_monthly: string;
    lead_boost_annual: string;
    website_monthly: string;
    website_annual: string;
    growth_monthly: string;
    growth_annual: string;
  };
  currentTier?: 'lead_boost' | 'website' | 'growth' | null;
  currentCycle?: 'monthly' | 'annual' | null;
};

export default function UpgradeModal({ listingSlug, priceIds, currentTier, currentCycle }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle ?? "monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open automatically if ?upgrade=true is in URL
  useEffect(() => {
    if (searchParams?.get("upgrade") === "true") setOpen(true);
  }, [searchParams]);

  const close = () => {
    setOpen(false);
    setError(null);
    // Clean the URL so refresh doesn't reopen
    const url = new URL(window.location.href);
    url.searchParams.delete("upgrade");
    router.replace(url.pathname + url.search);
  };

  const startCheckout = async (tier: Tier) => {
    setLoading(tier.id);
    setError(null);
    try {
      const res = await fetch("/api/billing-redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingSlug, tier: tier.id, cycle }),
      });
      const data = await res.json();
      if (data.already_on_tier) {
        setError(data.message || `You're already on the ${tier.name} tier.`);
        setLoading(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Try again or reply to any email for help.");
        setLoading(null);
      }
    } catch (e) {
      setError("Network error. Try again or reply to any email for help.");
      setLoading(null);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
      onClick={close}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 960,
          width: "100%",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            color: "#666",
          }}
          aria-label="Close"
        >
          ×
        </button>

        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>
          Upgrade your listing
        </h2>
        <p style={{ margin: "0 0 20px", color: "#666", fontSize: 15 }}>
          No contracts. Cancel anytime. Same price tomorrow as today.
        </p>

        {/* Monthly / Annual toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setCycle("monthly")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: cycle === "monthly" ? "#1a1a2e" : "#fff",
              color: cycle === "monthly" ? "#fff" : "#374151",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("annual")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: cycle === "annual" ? "#1a1a2e" : "#fff",
              color: cycle === "annual" ? "#fff" : "#374151",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Annual <span style={{ fontSize: 12, color: cycle === "annual" ? "#fbbf24" : "#16a34a", marginLeft: 4 }}>save 2 months</span>
          </button>
        </div>

        {/* Tier cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {TIERS.map((tier) => {
            const pt = getTierBySlug(tier.id);
            const price = pt ? (cycle === "monthly" ? pt.monthlyPrice : pt.annualPrice) : 0;
            const isLoading = loading === tier.id;
            const isCurrent = currentTier === tier.id && (currentCycle == null || currentCycle === cycle);
            return (
              <div
                key={tier.id}
                style={{
                  border: tier.highlight ? "2px solid #2563eb" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  position: "relative",
                }}
              >
                {tier.highlight && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 10px",
                      borderRadius: 12,
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{tier.name}</h3>
                <p style={{ margin: "0 0 12px", color: "#666", fontSize: 13, lineHeight: 1.4 }}>{tier.tagline}</p>
                <div style={{ margin: "0 0 16px" }}>
                  <span style={{ fontSize: 32, fontWeight: 700 }}>${price}</span>
                  <span style={{ color: "#666", fontSize: 14 }}>/{cycle === "monthly" ? "mo" : "yr"} USD</span>
                </div>
                <ul style={{ margin: "0 0 20px", padding: 0, listStyle: "none", fontSize: 14 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ padding: "4px 0", color: "#374151", display: "flex", gap: 6 }}>
                      <span style={{ color: "#16a34a" }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "2px solid #16a34a",
                      background: "#f0fdf4",
                      color: "#15803d",
                      fontSize: 15,
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    ✓ Your Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => startCheckout(tier)}
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: tier.highlight ? "#2563eb" : "#1a1a2e",
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: isLoading ? "wait" : "pointer",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? "Starting checkout..." : `Choose ${tier.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 14 }}>
            {error}
          </div>
        )}

        <p style={{ marginTop: 20, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
          Questions? Reply to any email Terry sent you — goes straight to his inbox.
        </p>
      </div>
    </div>
  );
}
