// pricing-version: 2026-05-17-reviews-plus-canonical
// CANONICAL PRICING — single source of truth
// All directory pricing pages, UpgradeModal, and Stripe checkout flows import from here.
// DO NOT hardcode prices, tier names, or feature lists elsewhere.

export type TierId = 'verified' | 'reviews_plus' | 'website' | 'growth';

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
    subtitle: 'Most pros start here',
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
      'SMS + email lead alerts',
      'Owner dashboard with Recent Leads',
      'Weekly digest of activity',
      'Branded inquiry emails to prospects',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $9/mo', mode: 'direct' },
    anchored: true,
  },
  website: {
    id: 'website',
    name: 'Website',
    subtitle: '',
    priceMonthlyUSD: 29,
    priceAnnualUSD: 290,
    stripeProductId: 'prod_UVCwbO2cUAURCF',
    stripePriceMonthlyId: 'price_1TWCWiB4nhVx1nmUlQWuYxkF',
    stripePriceAnnualId: 'price_1TWCWiB4nhVx1nmUtHQuD2co',
    visibleFeatures: [
      'Everything in Reviews Plus, plus:',
      'SiteForge-built website at your domain',
      'Mobile-optimized, fast-loading',
      'Click-to-call header',
      'Live Google reviews integration on your site',
      'Service pricing sections',
    ],
    expandedFeatures: [
      '7-day deploy from your existing content',
      'Schema.org markup for Google',
      'Monthly site updates',
      'SEO-optimized for your city + service',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $29/mo', mode: 'direct' },
    anchored: false,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    subtitle: '',
    priceMonthlyUSD: 97,
    priceAnnualUSD: 970,
    stripeProductId: 'prod_UVCwO2AN4M6aKT',
    stripePriceMonthlyId: 'price_1TWCWiB4nhVx1nmUcfLKGTtR',
    stripePriceAnnualId: 'price_1TWCWjB4nhVx1nmUyZB92HW8',
    visibleFeatures: [
      'Everything in Website, plus:',
      'Inbound lead CRM (track status, never lose a lead)',
      'Appointment booking on your listing',
      'Automated review request workflow',
      'Monthly performance report',
      'Priority support — direct line to Terry',
    ],
    expandedFeatures: [
      'Monthly blog post published for you',
      'Quarterly listing optimization review',
      'Competitor tracking',
    ],
    cta: { label: 'Get Growth', mode: 'direct' },
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
export const TIER_ORDER: TierId[] = ['verified', 'reviews_plus', 'website', 'growth'];

/** Look up a tier by a Stripe price ID (monthly or annual). */
export function getTierByPriceId(priceId: string): Tier | undefined {
  return Object.values(TIERS).find(
    (t) => t.stripePriceMonthlyId === priceId || t.stripePriceAnnualId === priceId,
  );
}
