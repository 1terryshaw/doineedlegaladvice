import verticalConfig from "@/lib/vertical.config";

interface TierBadgeProps {
  tier?: string;
  subscription_tier?: string;
  featured?: boolean;
  is_claimed?: boolean;
  gbp_url?: string | null;
}

const BASE = "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap";

// Honest two-tier claim badges. "Verified" means the owner confirmed by email AND
// linked a Google Business Profile — NOT that we independently checked Google.
const VERIFIED_TOOLTIP =
  "Verified: the owner confirmed this listing by email and added their Google Business Profile link. It does not mean we independently checked the business with Google.";
const CLAIMED_TOOLTIP =
  "Claimed: the business owner confirmed this listing by email.";

export default function TierBadge({
  tier,
  subscription_tier,
  featured,
  is_claimed,
  gbp_url,
}: TierBadgeProps) {
  const effectiveTier = subscription_tier || tier;

  if (effectiveTier === "growth") {
    return <span className={`${BASE} bg-purple-600 text-white`}>Growth</span>;
  }
  if (effectiveTier === "website") {
    return <span className={`${BASE} bg-amber-500 text-white`}>Website</span>;
  }
  if (effectiveTier === "reviews_plus" || effectiveTier === "reviews") {
    return (
      <span
        className={`${BASE} text-white`}
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Featured
      </span>
    );
  }
  if (featured) {
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
    const hasGbp = typeof gbp_url === "string" && gbp_url.trim().length > 0;
    if (hasGbp) {
      return (
        <span className={`${BASE} bg-green-100 text-green-800`} title={VERIFIED_TOOLTIP}>
          ✓ Verified
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
