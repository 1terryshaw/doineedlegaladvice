/**
 * Photo gallery caps by tier. Pure module — no server-only imports — so it is
 * safe to use from both API routes and client components.
 */
import { can } from "@/lib/tier-capabilities";

export const FREE_PHOTO_LIMIT = 3;
export const PAID_PHOTO_LIMIT = 10;

/** Photo gallery cap for a listing's tier — paid tiers (reviews_plus+) get more. */
export function photoLimitForTier(tier: string | null | undefined): number {
  return can(tier, "reviews_display") ? PAID_PHOTO_LIMIT : FREE_PHOTO_LIMIT;
}
