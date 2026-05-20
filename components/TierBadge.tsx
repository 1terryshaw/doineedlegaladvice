import verticalConfig from "@/lib/vertical.config";

interface TierBadgeProps {
  tier?: string;
  subscription_tier?: string;
  featured?: boolean;
  is_claimed?: boolean;
}

const BASE = "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap";

export default function TierBadge({
  tier,
  subscription_tier,
  featured,
  is_claimed,
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
    return (
      <span className={`${BASE} bg-green-100 text-green-800`}>✓ Verified</span>
    );
  }
  return null;
}
