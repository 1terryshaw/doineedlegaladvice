// pricing-version: 2026-05-17-reviews-plus-canonical
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { TIERS, TIER_ORDER, type TierId, type CTA } from "@/lib/pricing-canonical";

type BillingCycle = "monthly" | "annual";

type Props = {
  listingSlug: string;
  /** @deprecated Stripe price IDs now live in lib/pricing-canonical.ts.
   *  Kept optional so existing call sites compile without edits. */
  priceIds?: Record<string, string>;
  currentTier?: string | null;
  currentCycle?: BillingCycle | null;
};

const NEUTRAL_BORDER = "#e5e7eb";

export default function UpgradeModal({ listingSlug, currentTier, currentCycle }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle ?? "monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Open automatically if ?upgrade=true is in URL
  useEffect(() => {
    if (searchParams?.get("upgrade") === "true") setOpen(true);
  }, [searchParams]);

  const close = () => {
    setOpen(false);
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("upgrade");
    router.replace(url.pathname + url.search);
  };

  // Single checkout-initiation entry point.
  // mode 'free'   → no Stripe, route to the claim flow.
  // mode 'trial'  → Stripe Checkout with a 30-day trial.
  // mode 'direct' → Stripe Checkout, billed immediately.
  const startCheckout = async (tierId: TierId, mode: CTA["mode"]) => {
    if (mode === "free") {
      window.location.href = "/claim";
      return;
    }
    setLoading(`${tierId}:${mode}`);
    setError(null);
    try {
      const res = await fetch("/api/billing-redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingSlug, tier: tierId, cycle, mode }),
      });
      const data = await res.json();
      if (data.already_on_tier) {
        setError(data.message || `You're already on the ${TIERS[tierId].name} plan.`);
        setLoading(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Try again or reply to any email for help.");
        setLoading(null);
      }
    } catch {
      setError("Network error. Try again or reply to any email for help.");
      setLoading(null);
    }
  };

  if (!open) return null;

  const primary = verticalConfig.primaryColor || "#1a1a2e";

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
          maxWidth: 1120,
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

        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>Choose your plan</h2>
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
              border: `1px solid ${NEUTRAL_BORDER}`,
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
              border: `1px solid ${NEUTRAL_BORDER}`,
              background: cycle === "annual" ? "#1a1a2e" : "#fff",
              color: cycle === "annual" ? "#fff" : "#374151",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Annual{" "}
            <span style={{ fontSize: 12, color: cycle === "annual" ? "#fbbf24" : "#16a34a", marginLeft: 4 }}>
              save 2 months
            </span>
          </button>
        </div>

        {/* Tier cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {TIER_ORDER.map((id) => {
            const tier = TIERS[id];
            const anchored = tier.anchored;
            const isFree = tier.priceMonthlyUSD === 0;
            const price = cycle === "monthly" ? tier.priceMonthlyUSD : tier.priceAnnualUSD;
            const unit = cycle === "monthly" ? "mo" : "yr";
            const isCurrent =
              currentTier === tier.id &&
              (isFree || currentCycle == null || currentCycle === cycle);
            const isExpanded = !!expanded[tier.id];
            const busy = (m: string) => loading === `${tier.id}:${m}`;

            return (
              <div
                key={tier.id}
                style={{
                  border: anchored
                    ? `1.5px solid ${primary}`
                    : `0.5px solid ${NEUTRAL_BORDER}`,
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{tier.name}</h3>

                {/* Anchored tier: subtitle as a colored tag above the price.
                    Other tiers: subtitle as plain helper text. NO "Most Popular" badge. */}
                {anchored ? (
                  <span
                    style={{
                      alignSelf: "flex-start",
                      background: primary,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 10px",
                      borderRadius: 12,
                      margin: "6px 0 10px",
                    }}
                  >
                    {tier.subtitle}
                  </span>
                ) : tier.subtitle ? (
                  <p style={{ margin: "0 0 10px", color: "#666", fontSize: 13 }}>{tier.subtitle}</p>
                ) : (
                  <div style={{ height: 10 }} />
                )}

                <div style={{ margin: "0 0 16px" }}>
                  {isFree ? (
                    <span style={{ fontSize: 32, fontWeight: 700 }}>Free</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 32, fontWeight: 700 }}>${price}</span>
                      <span style={{ color: "#666", fontSize: 14 }}>/{unit} USD</span>
                    </>
                  )}
                </div>

                <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", fontSize: 14, flex: 1 }}>
                  {tier.visibleFeatures.map((f) => (
                    <li key={f} style={{ padding: "4px 0", color: "#374151", display: "flex", gap: 6 }}>
                      <span style={{ color: "#16a34a" }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                  {isExpanded &&
                    tier.expandedFeatures.map((f) => (
                      <li key={f} style={{ padding: "4px 0", color: "#374151", display: "flex", gap: 6 }}>
                        <span style={{ color: "#16a34a" }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                </ul>

                {tier.expandedFeatures.length > 0 && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [tier.id]: !e[tier.id] }))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: primary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      marginBottom: 16,
                      textAlign: "left",
                    }}
                  >
                    {isExpanded ? "Hide features" : "See all features"}
                  </button>
                )}

                {/* CTA block */}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => startCheckout(tier.id, tier.cta.mode)}
                      disabled={busy(tier.cta.mode)}
                      style={{
                        width: "100%",
                        padding: "11px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: anchored ? primary : "#1a1a2e",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: busy(tier.cta.mode) ? "wait" : "pointer",
                        opacity: busy(tier.cta.mode) ? 0.6 : 1,
                      }}
                    >
                      {busy(tier.cta.mode)
                        ? "Starting checkout..."
                        : tier.cta.mode === "direct" && !isFree
                          ? `${tier.cta.label} — $${tier.priceMonthlyUSD}/mo`
                          : tier.cta.label}
                    </button>

                    {tier.secondaryCta && (
                      <button
                        onClick={() => startCheckout(tier.id, tier.secondaryCta!.mode)}
                        disabled={busy(tier.secondaryCta.mode)}
                        style={{
                          width: "100%",
                          padding: "6px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "#6b7280",
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: "underline",
                          cursor: busy(tier.secondaryCta.mode) ? "wait" : "pointer",
                          opacity: busy(tier.secondaryCta.mode) ? 0.6 : 1,
                        }}
                      >
                        {busy(tier.secondaryCta.mode)
                          ? "Starting checkout..."
                          : tier.secondaryCta.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#991b1b",
              fontSize: 14,
            }}
          >
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
