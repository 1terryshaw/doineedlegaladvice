// pricing-version: 2026-05-12-usd-v2
import verticalConfig from "@/lib/vertical.config";

export interface PricingTier {
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Leads Boost",
    slug: "lead_boost",
    monthlyPrice: 9,
    annualPrice: 90,
    stripePriceIdMonthly: "price_1TWCWhB4nhVx1nmU7e5wn3EI",
    stripePriceIdAnnual: "price_1TWCWhB4nhVx1nmU9rAwLlH0",
    features: [
      "Lead forwarding — email + SMS within seconds",
      "Full Google review display on your listing",
      "Priority placement in search results",
      "Cross-referral visibility across our network",
      "AI-powered review response drafts",
      "Automatic review request sequence",
      "No contracts, cancel anytime",
    ],
  },
  {
    name: "Website",
    slug: "website",
    monthlyPrice: 29,
    annualPrice: 290,
    stripePriceIdMonthly: "price_1TWCWiB4nhVx1nmUlQWuYxkF",
    stripePriceIdAnnual: "price_1TWCWiB4nhVx1nmUtHQuD2co",
    features: [
      "Everything in Leads Boost tier",
      "Full custom website built from your content",
      "Deployed in 7 days",
      "Or drop-in landing page for existing sites",
    ],
    highlighted: true,
  },
  {
    name: "Growth",
    slug: "growth",
    monthlyPrice: 97,
    annualPrice: 970,
    stripePriceIdMonthly: "price_1TWCWiB4nhVx1nmUcfLKGTtR",
    stripePriceIdAnnual: "price_1TWCWjB4nhVx1nmUyZB92HW8",
    features: [
      "Everything in Website tier",
      "Monthly blog post published for you",
      "Review response drafts",
      "Priority support",
    ],
  },
];

export function getTierBySlug(slug: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.slug === slug);
}

export function getTierByPriceId(priceId: string): PricingTier | undefined {
  return PRICING_TIERS.find(
    (t) => t.stripePriceIdMonthly === priceId || t.stripePriceIdAnnual === priceId
  );
}

export function isValidPriceId(priceId: string): boolean {
  return getTierByPriceId(priceId) !== undefined;
}

export { verticalConfig };
