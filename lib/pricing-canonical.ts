// pricing-version: 2026-06-18-596-ladder
// CANONICAL PRICING — single source of truth
// All directory pricing pages, UpgradeModal, and Stripe checkout flows import from here.
// DO NOT hardcode prices, tier names, or feature lists elsewhere.

export type TierId = 'verified' | 'reviews_plus' | 'website';

export interface CTA {
  label: string;
  /**
   * - 'trial' → Stripe Checkout with trial_period_days=30
   * - 'direct' → Stripe Checkout with no trial
   * - 'free' → no Stripe; activates free tier on claim
   */
  mode: 'trial' | 'direct' | 'free';
}

export interface Tier {
  id: TierId;
  name: string;
  subtitle: string;
  priceMonthlyUSD: number;
  priceAnnualUSD: number;
  stripeProductId: string | null;
  stripePriceMonthlyId: string | null;
  stripePriceAnnualId: string | null;
  /** 5-6 bullets shown on the pricing card */
  visibleFeatures: string[];
  /** Additional features behind a "See all features" expand */
  expandedFeatures: string[];
  /** Primary CTA */
  cta: CTA;
  /** Secondary CTA (optional, for trial + direct purchase pattern) */
  secondaryCta?: CTA;
  /** Visually anchored on the card grid */
  anchored: boolean;
}

export const TIERS: Record<TierId, Tier> = {
  verified: {
    id: 'verified',
    name: 'Verified',
    subtitle: 'Free forever — no credit card',
    priceMonthlyUSD: 0,
    priceAnnualUSD: 0,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceAnnualId: null,
    visibleFeatures: [
      '"Verified" badge on your listing',
      'Contact info, hours, services displayed',
      'Up to 3 photos',
      'Star rating + Google review count',
      'Inquiry form sent to your email',
      'Custom description and service area',
    ],
    expandedFeatures: [],
    cta: { label: 'Claim Your Free Listing', mode: 'free' },
    anchored: false,
  },
  reviews_plus: {
    id: 'reviews_plus',
    name: 'Reviews Plus',
    subtitle: 'Most pros start here.',
    priceMonthlyUSD: 9,
    priceAnnualUSD: 90,
    stripeProductId: 'prod_UVCwwsGLZrCrFh',
    stripePriceMonthlyId: 'price_1TWCWhB4nhVx1nmU7e5wn3EI',
    stripePriceAnnualId: 'price_1TWCWhB4nhVx1nmU9rAwLlH0',
    visibleFeatures: [
      '"Featured" badge (vs Verified)',
      'Up to 10 photos + hero cover image',
      'Top-of-browse placement in directory search',
      'Listing health score in your dashboard',
      '"Welcome to Reviews Plus" PDF playbook',
    ],
    expandedFeatures: [
      'All Verified features',
      'Recent Leads dashboard (existing inquiries to you, through the directory)',
      'Email lead alerts',
      'Weekly digest of activity',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $9/mo', mode: 'direct' },
    anchored: true,
  },
  website: {
    id: 'website',
    name: 'Website',
    subtitle: '',
    priceMonthlyUSD: 49,
    priceAnnualUSD: 490,
    stripeProductId: 'prod_UVCwbO2cUAURCF',
    stripePriceMonthlyId: 'price_1TjfMNB4nhVx1nmUtSlsXNFW',
    stripePriceAnnualId: 'price_1TjfMNB4nhVx1nmUQlFCiwyl',
    visibleFeatures: [
      'Everything in Reviews Plus, plus:',
      'SiteForge-built website at your domain (concierge delivered)',
      'SMS + email lead alerts',
      'Weekly digest of activity',
      'Branded inquiry emails to prospects',
    ],
    expandedFeatures: [
      'Mobile-optimized, fast-loading',
      'Click-to-call header',
      'Service pricing sections',
      'Built for Google search (Schema.org, city/service pages)',
      'Custom domain wiring (when delivered)',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $49/mo', mode: 'direct' },
    anchored: false,
  },
};

/** Trial config — single source of truth */
export const TRIAL = {
  days: 30,
  /** Single notification day relative to trial end (one day before billing) */
  notifyDaysBeforeEnd: 1,
} as const;

/** Ordered tier list for rendering the card grid (left → right). */
export const TIER_ORDER: TierId[] = ['verified', 'reviews_plus', 'website'];

/**
 * Legacy Growth price IDs — the Growth tier was removed per #596 (2026-06-18).
 * Resolve them explicitly to undefined so any stale handoff token degrades
 * gracefully. empire-billing's reverse map is the primary handler; this is a
 * layered defense.
 */
const LEGACY_GROWTH_PRICE_IDS: ReadonlySet<string> = new Set([
  'price_1TWCWiB4nhVx1nmUcfLKGTtR',
  'price_1TWCWjB4nhVx1nmUyZB92HW8',
]);

/** Look up a tier by a Stripe price ID (monthly or annual). */
export function getTierByPriceId(priceId: string): Tier | undefined {
  if (LEGACY_GROWTH_PRICE_IDS.has(priceId)) return undefined;
  return Object.values(TIERS).find(
    (t) => t.stripePriceMonthlyId === priceId || t.stripePriceAnnualId === priceId,
  );
}
