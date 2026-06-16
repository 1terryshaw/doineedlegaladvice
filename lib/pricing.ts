/**
 * Re-export shim. Pricing source of truth is ./pricing-canonical.
 * This file kept to preserve forgotten import sites. To be removed in a future cleanup pass.
 * Last shimmed: 2026-06-16
 */
export { TIERS as PRICING_TIERS, getTierByPriceId, TRIAL, TIER_ORDER } from './pricing-canonical';
export type { TierId, Tier, CTA } from './pricing-canonical';
