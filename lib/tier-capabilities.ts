/**
 * Tier capability map + helpers.
 * Single source of truth for what each tier actually unlocks in the app.
 * Marketing copy lives in lib/pricing.ts; enforcement logic lives here.
 */

export type TierSlug =
  | "seed"
  | "free"
  | "lead_boost"
  | "website"
  | "growth"
  | "payment_error_review";

export type Capability =
  | "lead_forwarding"
  | "reviews_display"
  | "featured"
  | "analytics"
  | "priority_search"
  | "siteforge"
  | "custom_domain";

type CapabilityMap = Record<Capability, boolean>;

export const TIER_CAPABILITIES: Record<TierSlug, CapabilityMap> = {
  seed: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  free: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  lead_boost: {
    lead_forwarding: true,
    reviews_display: true,
    featured: false,
    analytics: true,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  website: {
    lead_forwarding: true,
    reviews_display: true,
    featured: true,
    analytics: true,
    priority_search: true,
    siteforge: true,
    custom_domain: false,
  },
  growth: {
    lead_forwarding: true,
    reviews_display: true,
    featured: true,
    analytics: true,
    priority_search: true,
    siteforge: true,
    custom_domain: true,
  },
  payment_error_review: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
};

/**
 * Check if a tier has a capability. Safe on null/undefined/unknown input —
 * returns false rather than throwing.
 */
// Backward compat: DB may still have "reviews" until CHECK constraint is updated
const TIER_ALIASES: Record<string, TierSlug> = {
  reviews: "lead_boost",
  claimed: "free",
};

export function can(
  tier: TierSlug | string | null | undefined,
  capability: Capability
): boolean {
  if (!tier) return false;
  const resolved = TIER_ALIASES[tier] || tier;
  const caps = TIER_CAPABILITIES[resolved as TierSlug];
  if (!caps) return false;
  return caps[capability] === true;
}

/**
 * Public-facing tier label.
 * `seed` and `payment_error_review` both show as "Free" to end users.
 */
export function getTierDisplayName(
  tier: TierSlug | string | null | undefined
): "Free" | "Lead Boost" | "Website" | "Growth" {
  const t = TIER_ALIASES[tier as string] || tier;
  switch (t) {
    case "lead_boost":
      return "Lead Boost";
    case "website":
      return "Website";
    case "growth":
      return "Growth";
    default:
      return "Free";
  }
}

/**
 * Upgrade-path helper. Returns the next tier slug up, or null if already top.
 * seed → reviews, free → reviews, reviews → website, website → growth, growth → null.
 * Unknown/error tiers default to reviews (encourage upgrade after resolution).
 */
export function getNextTier(
  currentTier: TierSlug | string | null | undefined
): TierSlug | null {
  const ct = TIER_ALIASES[currentTier as string] || currentTier;
  switch (ct) {
    case "seed":
    case "free":
    case "payment_error_review":
      return "lead_boost";
    case "lead_boost":
      return "website";
    case "website":
      return "growth";
    case "growth":
      return null;
    default:
      return "lead_boost";
  }
}

/**
 * Sort priority for search/category listings.
 * Higher number = shown first. Paid tiers outrank free.
 */
export function getTierPriority(
  tier: TierSlug | string | null | undefined
): number {
  const t = TIER_ALIASES[tier as string] || tier;
  switch (t) {
    case "growth":
      return 4;
    case "website":
      return 3;
    case "lead_boost":
      return 2;
    case "free":
    case "payment_error_review":
      return 1;
    case "seed":
    default:
      return 0;
  }
}
