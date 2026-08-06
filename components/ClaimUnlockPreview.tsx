import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

interface Props {
  listingSlug: string;
  /** True when the row already carries Google reviews (google_review_count > 0) —
   *  the only "respond to reviews" makes sense. Derived from an already-loaded
   *  field; this component never issues its own query. */
  hasReviews: boolean;
}

// SERVER component (no "use client", no hooks) — fully present in raw SSR / JS-off.
// Shown ONLY on UNCLAIMED detail pages (the page gates on !listing.claimed). The
// whole card is a single link to /claim/{slug}; the grayed rows are non-functional
// previews of the owner features a free claim unlocks (no real photo/hours/review
// UI is exposed to anonymous visitors).
export default function ClaimUnlockPreview({ listingSlug, hasReviews }: Props) {
  const rows = [
    "Manage your photos",
    "Update hours & business info",
    ...(hasReviews ? ["Respond to your reviews"] : []),
  ];
  return (
    <Link
      href={`/claim/${listingSlug}?src=detail_unlock_preview`}
      className="mt-8 block rounded-lg border bg-gray-50 p-6 no-underline transition-colors hover:border-gray-400"
    >
      <p className="font-semibold text-gray-900">Own this business? Claim it free to unlock:</p>
      <ul className="mt-3 space-y-2">
        {rows.map((label) => (
          <li key={label} className="flex items-center gap-2 text-sm text-gray-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <span
        className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Claim This Listing
      </span>
    </Link>
  );
}
