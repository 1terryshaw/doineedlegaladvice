import { createClient } from '@supabase/supabase-js';
import { can } from '@/lib/tier-capabilities';

interface ReviewShowcaseProps {
  googlePlaceId: string;
  subscriptionTier: string;
  fallbackRating?: number;
  fallbackCount?: number;
}

export default async function ReviewShowcase({
  googlePlaceId,
  subscriptionTier,
  fallbackRating,
  fallbackCount,
}: ReviewShowcaseProps) {

  // Reviews carousel is gated by the reviews_display capability.
  // Tiers without it (free / seed) get a bare star rating only.
  // can() resolves the legacy "reviews" alias of reviews_plus.
  if (!can(subscriptionTier, 'reviews_display')) {
    if (!fallbackRating || !fallbackCount) return null;
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-yellow-500">{'★'.repeat(Math.round(fallbackRating))}</span>
        <span className="text-gray-600">{fallbackRating.toFixed(1)} ({fallbackCount} reviews)</span>
      </div>
    );
  }

  // Tier has reviews_display: fetch cached reviews
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: cache } = await supabase
    .from('listings_reviews_cache')
    .select('*')
    .eq('google_place_id', googlePlaceId)
    .single();

  // Fallback to bare rating if no cache yet, or the cached row has expired.
  // Legacy pre-#594 rows are kept as a forensic record but must not render once expired.
  if (!cache || !cache.top_reviews || cache.top_reviews.length === 0 ||
      (cache.expires_at && new Date(cache.expires_at) < new Date())) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-yellow-500">{'★'.repeat(Math.round(fallbackRating || 5))}</span>
        <span className="text-gray-600">{(fallbackRating || 5).toFixed(1)} ({fallbackCount || 0} reviews)</span>
      </div>
    );
  }

  const reviews = cache.top_reviews;

  return (
    <div className="border rounded-lg p-4 bg-white space-y-4">
      {/* Header: stars + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-lg">{'★'.repeat(Math.round(cache.rating))}</span>
          <span className="font-bold text-lg">{Number(cache.rating).toFixed(1)}</span>
          <span className="text-gray-600">({cache.user_ratings_total} reviews on Google)</span>
        </div>
      </div>

      {/* Review cards */}
      <div className="space-y-3">
        {reviews.map((r: { text: string; author_name: string; relative_time: string }, i: number) => (
          <div key={i} className="border-l-4 border-yellow-400 pl-3 py-1">
            <p className="text-sm text-gray-800 italic">&ldquo;{r.text}&rdquo;</p>
            <p className="text-xs text-gray-500 mt-1">
              &mdash; {r.author_name}, {r.relative_time}
            </p>
          </div>
        ))}
      </div>

      {/* Attribution (required by Google ToS) */}
      <p className="text-xs text-gray-400 text-right">Powered by Google</p>
    </div>
  );
}
