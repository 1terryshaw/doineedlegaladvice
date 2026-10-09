// pricing-version: 2026-06-18-596-ladder
// CANONICAL PRICING — single source of truth
// All directory pricing pages, UpgradeModal, and Stripe checkout flows import from here.
// DO NOT hardcode prices, tier names, or feature lists elsewhere.

export type TierId = 'verified' | 'reviews_plus' | 'website_basic' | 'website';

export interface CTA {
  label: string;
  /**
   * - 'trial' → Stripe Checkout with trial_period_days=30
   * - 'direct' → Stripe Checkout with no trial
   * - 'free' → no Stripe; activates free tier on claim
   * - 'preview' → no Stripe; requests a free website preview (owner login required)
   */
  mode: 'trial' | 'direct' | 'free' | 'preview';
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
  /** Price is monthly only — no annual price; the annual toggle does not apply. */
  monthlyOnly?: boolean;
  /** Small print under the CTA. */
  footnote?: string;
  /** Tier slug sent to /api/billing-redirect when it differs from `id` (the $49 card requests the same Website preview). */
  billingTier?: 'website';
}

export const TIERS: Record<TierId, Tier> = {
  // leads-plus-fleet-fan-v1 (card spec, CEO R9): the Free card carries NO inquiry form — customers contact
  // the business directly. Free and unclaimed listings never get a form.
  verified: {
    id: 'verified',
    name: 'Free',
    subtitle: 'Free forever — no credit card',
    priceMonthlyUSD: 0,
    priceAnnualUSD: 0,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceAnnualId: null,
    visibleFeatures: [
      '"Claimed" badge — becomes "Reviews verified" once your Google rating loads',
      'Contact info, hours, services displayed',
      'Up to 3 photos',
      'Star rating + Google review count',
      'Customers call, email or visit you directly (no inquiry form)',
      'Custom description and service area',
    ],
    expandedFeatures: [],
    cta: { label: 'Claim Your Free Listing', mode: 'free' },
    anchored: false,
  },
  // R11 GO (leads-plus-canary-v1, CEO 2026-10-09): every surface that started a NEW $9 Reviews Plus checkout now
  // offers Leads Plus $19 USD/mo instead (id stays 'reviews_plus' — the listing tier slug Leads Plus is stored as;
  // /api/billing-redirect turns a new reviews_plus checkout into the leads_plus handoff). Same 30-day trial and
  // "Skip trial, pay now" as Reviews Plus. Monthly only (R5). Existing $9 subs are untouched.
  reviews_plus: {
    id: 'reviews_plus',
    name: 'Leads Plus',
    subtitle: 'Most pros start here. Reviews Plus included.',
    priceMonthlyUSD: 19,
    priceAnnualUSD: 0,
    monthlyOnly: true,
    stripeProductId: 'prod_VPQ7Uzaq6ShYBv',
    stripePriceMonthlyId: 'price_1UObHCB4nhVx1nmU7yb9XJkY',
    stripePriceAnnualId: null,
    visibleFeatures: [
      'Customers send you inquiries straight from your listing page',
      'Every inquiry emailed to you instantly — reply from your inbox',
      'Your page content drafted from your listing — you approve every word',
      'Reviews Plus included: top Google reviews + "Featured" badge',
      'Up to 10 photos + hero cover image',
      'Leads inbox + button-tap counts in your dashboard',
    ],
    expandedFeatures: [
      'All Free features',
      'Share link, QR code and ready-made bio / email-signature snippets',
      'Free guides to route inquiries to your phone, staff or a spreadsheet',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $19/mo', mode: 'direct' },
    anchored: true,
  },
  // leads-plus-fleet-fan-v1 (card spec): the $49 Website card. Same free-preview-first flow as the $99 card
  // (billing-redirect tier 'website' → preview request; the plan is chosen when the owner approves the preview).
  website_basic: {
    id: 'website_basic',
    name: 'Website',
    subtitle: 'Free preview first — no card until you approve it',
    priceMonthlyUSD: 49,
    priceAnnualUSD: 0,
    monthlyOnly: true,
    stripeProductId: 'prod_UVCwbO2cUAURCF',
    stripePriceMonthlyId: 'price_1TjfMNB4nhVx1nmUtSlsXNFW',
    stripePriceAnnualId: null,
    visibleFeatures: [
      'Everything in Leads Plus, plus:',
      'Your own website, built for your business',
      'Mobile-friendly, fast, click-to-call',
      'See a free preview before you pay anything',
    ],
    expandedFeatures: [],
    cta: { label: 'See Your Free Preview', mode: 'preview' },
    billingTier: 'website',
    footnote: 'No contract. Cancel anytime.',
    anchored: false,
  },
  website: {
    id: 'website',
    name: 'Website + AI Receptionist',
    subtitle: 'Free preview first — no card until you approve it',
    priceMonthlyUSD: 99,
    priceAnnualUSD: 990,   // annual-v1: $990/yr = 10x monthly (Website is chosen at preview approval)
    stripeProductId: 'prod_VMZoJGkrEewful',
    stripePriceMonthlyId: 'price_1ULqfAB4nhVx1nmU1g2yvHjs',
    stripePriceAnnualId: 'price_1UMVBvB4nhVx1nmUr3yDlPtU',
    visibleFeatures: [
      'Everything in Reviews Plus, plus:',
      'Custom website built for your business, on your domain',
      'AI chat receptionist that answers visitors and emails you leads',
      'Mobile-friendly, fast, click-to-call',
      'Set up for Google in your city + service',
      'Small edits included every month',
    ],
    expandedFeatures: [],
    cta: { label: 'See Your Free Preview', mode: 'preview' },
    footnote: 'No contract. Cancel anytime.',
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
export const TIER_ORDER: TierId[] = ['verified', 'reviews_plus', 'website_basic', 'website'];

/** Single source of truth: map a raw owner tier → the pricing-canonical tier id used by
 * current-plan comparison (currentTier === tier.id; the free tier id is "verified").
 * A claimed owner with no paid tier is on the free "Verified" plan; unclaimed/no-owner → null.
 * Normalizes the VALUE only — never touches owner-session detection or auth. */
export function normalizeTierForPricing(rawTier: string | null | undefined, claimed: boolean): string | null {
  if (rawTier === "reviews_plus" || rawTier === "website" || rawTier === "growth") return rawTier;
  return claimed ? "verified" : null;
}

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
