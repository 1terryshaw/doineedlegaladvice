import Link from "next/link";
import { Listing } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import TierBadge from "@/components/TierBadge";

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
  // TDL #788 — null-safe row enrichment. firm_name is NOT on the Listing TS type
  // (lib/supabase.ts is DO-NOT-TOUCH) but IS selected via select("*"); ~47%
  // populated on legal_listings. Each field collapses when absent — no empty
  // placeholders. On FL/CA (no phone) the card degrades to name (+ firm).
  const firmName = (listing as { firm_name?: string }).firm_name?.trim();
  const showFirm = !!firmName && firmName.toLowerCase() !== listing.name.toLowerCase();
  const phone = listing.phone?.trim();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

  return (
    // Stretched-link pattern: the whole card navigates to the detail page via an
    // absolutely-positioned overlay Link, so the tap-to-call phone <a> can be a
    // sibling (not a nested anchor — which is invalid HTML).
    <div className="block border rounded-xl p-6 hover:translate-y-[-4px] hover:shadow-lg transition-all duration-200 bg-white overflow-hidden relative">
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${verticalConfig.primaryColor}, transparent)`,
        }}
      />
      <Link
        href={`/directory/${listing.slug}`}
        className="absolute inset-0 z-0"
        aria-label={listing.name}
      />
      <div className="relative z-10 pointer-events-none">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{listing.name}</h3>
            {showFirm && (
              <p className="text-sm text-gray-500 mt-0.5">{firmName}</p>
            )}
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
          <TierBadge
            tier={listing.tier}
            subscription_tier={listing.subscription_tier}
            featured={listing.featured}
            is_claimed={listing.claimed}
          />
          {listing.now_hiring && (
            <span className="bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded-full ml-2">Now Hiring</span>
          )}
        </div>
        {listing.short_description && (
          <p className="text-gray-600 mt-3 text-sm line-clamp-2">{listing.short_description}</p>
        )}
        {telHref && (
          <a
            href={telHref}
            className="pointer-events-auto relative z-20 mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: verticalConfig.primaryColor }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {phone}
          </a>
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
      </div>
    </div>
  );
}
