import verticalConfig from "@/lib/vertical.config";
import { can, getEffectiveTier } from "@/lib/tier-capabilities";

interface TierBadgeProps {
  tier?: string;
  subscription_tier?: string;
  is_claimed?: boolean;
  // "Reviews verified" keys on whether the Google rating/reviews ACTUALLY display on
  // the listing — i.e. the same `google_rating` gate the detail page uses to render
  // the star rating + review count. NOT gbp_url presence (a linked profile with no
  // rating shows nothing, so calling it "verified" would be dishonest).
  google_rating?: number | string | null;
}

const BASE = "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap";

const REVIEWS_VERIFIED_TOOLTIP =
  "Reviews verified: this listing's Google rating and review count are shown here. It does not mean we independently checked or endorsed the business.";
const CLAIMED_TOOLTIP =
  "Claimed: the business owner confirmed this listing by email.";

export default function TierBadge({
  tier,
  subscription_tier,
  is_claimed,
  google_rating,
}: TierBadgeProps) {
  // TDL #471: the premium/Featured badge renders ONLY when the listing's LIVE
  // subscription grants the "featured" entitlement (Reviews Plus or higher) — keyed off
  // the same capability system the #472 guard uses, NOT a stored publish/featured flag.
  const effectiveTier = getEffectiveTier({ tier, subscription_tier });

  if (can(effectiveTier, "featured")) {
    if (effectiveTier === "growth") {
      return <span className={`${BASE} bg-purple-600 text-white`}>Growth</span>;
    }
    if (effectiveTier === "website") {
      return <span className={`${BASE} bg-amber-500 text-white`}>Website</span>;
    }
    return (
      <span
        className={`${BASE} text-white`}
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Featured
      </span>
    );
  }

  if (is_claimed) {
    // Reviews actually display <=> the detail-page rating line renders (google_rating > 0).
    const reviewsDisplay = Number(google_rating) > 0;
    if (reviewsDisplay) {
      return (
        <span className={`${BASE} bg-green-100 text-green-800`} title={REVIEWS_VERIFIED_TOOLTIP}>
          ✓ Reviews verified
        </span>
      );
    }
    return (
      <span className={`${BASE} bg-gray-100 text-gray-700`} title={CLAIMED_TOOLTIP}>
        Claimed
      </span>
    );
  }

  return null;
}
