/**
 * CANONICAL SOURCE. Per-vertical copies of this file must md5-match this canonical.
 * Divergences are drift and get flagged by scripts/check-canonical-drift.mjs.
 * Per-vertical identity is env-var driven (BILLING_HMAC_SECRET, BILLING_VERTICAL_SLUG) — do NOT hard-code slug/secrets here.
 * To modify: change this file, then run the drift-check to see per-vertical impact, then stamp each vertical intentionally.
 *
 * Origin: copied verbatim from idealskitrip 2026-07-20 (empire-monetization-consolidation-audit §2 baseline).
 * Loop: empire-canonical-monetization-scaffold-v1. This scaffold REWIRES NOBODY — verticals keep their forked copies.
 */
/**
 * Tier capability map + helpers.
 * Single source of truth for what each tier actually unlocks in the app.
 * Marketing copy lives in lib/pricing.ts; enforcement logic lives here.
 */

export type TierSlug =
  | "seed"
  | "free"
  | "reviews_plus"
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
  | "custom_domain"
  // leads-plus-canary-v1: the Leads Plus entitlement (lead form + content kit). Granted by
  // Reviews Plus and every tier above it (R1/R2; migration: active Reviews Plus subs grant it).
  // Read it ONLY through hasLeadsPlus() in lib/leads-plus.ts.
  | "leads_plus";

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
    leads_plus: false,
  },
  free: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
    leads_plus: false,
  },
  reviews_plus: {
    lead_forwarding: true,
    reviews_display: true,
    featured: true,
    analytics: true,
    priority_search: true,
    siteforge: false,
    custom_domain: false,
    leads_plus: true,
  },
  website: {
    lead_forwarding: true,
    reviews_display: true,
    featured: true,
    analytics: true,
    priority_search: true,
    siteforge: true,
    custom_domain: false,
    leads_plus: true,
  },
  growth: {
    lead_forwarding: true,
    reviews_display: true,
    featured: true,
    analytics: true,
    priority_search: true,
    siteforge: true,
    custom_domain: true,
    leads_plus: true,
  },
  payment_error_review: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
    leads_plus: false,
  },
};

/**
 * Check if a tier has a capability. Safe on null/undefined/unknown input —
 * returns false rather than throwing.
 */
// Backward compat: DB may still have "reviews" until CHECK constraint is updated
const TIER_ALIASES: Record<string, TierSlug> = {
  reviews: "reviews_plus",
  claimed: "free",
  // leads-plus-canary-v1: a Leads Plus purchase is stored as reviews_plus (same ordering — R3).
  leads_plus: "reviews_plus",
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
 * The tier that actually governs entitlements: the paid `subscription_tier` when present,
 * else the operational `tier` column. (Mirrors getapro / the #472 guard.)
 */
export function getEffectiveTier(
  listing: { tier?: string | null; subscription_tier?: string | null }
): string {
  const sub = listing.subscription_tier;
  if (sub && sub !== "free") return sub;
  return listing.tier || "free";
}

/**
 * Public-facing tier label.
 * `seed` and `payment_error_review` both show as "Free" to end users.
 */
export function getTierDisplayName(
  tier: TierSlug | string | null | undefined
): "Free" | "Reviews Plus" | "Website" | "Growth" {
  const t = TIER_ALIASES[tier as string] || tier;
  switch (t) {
    case "reviews_plus":
      return "Reviews Plus";
    case "website":
      return "Website";
    case "growth":
      return "Growth";
    default:
      return "Free";
  }
}

/**
 * Upgrade-path helper (billing-ledger-and-nexttier-fix-v1). A free / claimed listing's next tier is what THIS host sells a
 * NEW customer: Leads Plus where the host's Leads Plus gate is open, else the cheapest Website plan its upgrade modal sells,
 * else none (no upgrade link). Never Reviews Plus — it is retired for new customers (R11 / TDL #1374).
 * Paid tiers (grandfathered owners) are unchanged: reviews_plus → website, website → growth, growth → null.
 * `offer` comes from the owner page (server side, the same gates checkout uses); omitted ⇒ nothing is known to be on sale.
 */
export type HostOffer = { leadsPlus: boolean; website: boolean; leadsPlusHref?: string };
export type NextTier = TierSlug | "leads_plus";

export function getNextTier(
  currentTier: TierSlug | string | null | undefined,
  offer: HostOffer = { leadsPlus: false, website: false }
): NextTier | null {
  const ct = TIER_ALIASES[currentTier as string] || currentTier;
  switch (ct) {
    case "reviews_plus":
      return "website";
    case "website":
      return "growth";
    case "growth":
      return null;
    default:
      // seed / free / claimed / payment_error_review / unknown — a new customer.
      return offer.leadsPlus ? "leads_plus" : offer.website ? "website" : null;
  }
}

/** Label for a getNextTier result ("leads_plus" is not a stored tier, so getTierDisplayName would alias it to Reviews Plus). */
export function getNextTierLabel(t: NextTier): string {
  return t === "leads_plus" ? "Leads Plus" : getTierDisplayName(t);
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
    case "reviews_plus":
      return 2;
    case "free":
    case "payment_error_review":
      return 1;
    case "seed":
    default:
      return 0;
  }
}
