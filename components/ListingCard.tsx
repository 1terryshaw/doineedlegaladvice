import Link from "next/link";
import { Listing } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-amber-400 tracking-tight text-sm">
      {"★".repeat(full)}
      {half && "★"}
      {"☆".repeat(empty)}
    </span>
  );
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/directory/${listing.slug}`}
      className="block border rounded-xl p-6 hover:translate-y-[-4px] hover:shadow-lg transition-all duration-200 bg-white overflow-hidden relative"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${verticalConfig.primaryColor}, transparent)`,
        }}
      />
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{listing.name}</h3>
          {listing.city && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {listing.city}
              </span>
              {listing.province_state && (
                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {listing.province_state}
                </span>
              )}
            </div>
          )}
        </div>
        {listing.claimed && !['lead_boost', 'website', 'growth'].includes((listing.tier || listing.subscription_tier || '') as string) && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
            ✓ Claimed
          </span>
        )}
        {listing.featured && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: verticalConfig.primaryColor }}
          >
            Featured
          </span>
        )}
        {listing.now_hiring && (
          <span className="bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded-full ml-2">Now Hiring</span>
        )}
      </div>
      {listing.short_description && (
        <p className="text-gray-600 mt-3 text-sm line-clamp-2">{listing.short_description}</p>
      )}
      {listing.google_rating && (
        <div className="mt-3 flex items-center gap-1 text-sm text-gray-500">
          {renderStars(listing.google_rating)}
          <span>{listing.google_rating}</span>
          {listing.google_review_count && (
            <span>({listing.google_review_count} reviews)</span>
          )}
        </div>
      )}
    </Link>
  );
}
