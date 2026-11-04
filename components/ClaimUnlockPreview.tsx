import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

interface Props {
  listingSlug: string;
  /** True when the row already carries Google reviews (google_review_count > 0) —
   *  the only "respond to reviews" makes sense. Derived from an already-loaded
   *  field; this component never issues its own query. */
  hasReviews: boolean;
}

// organic-unlock-v2 experiment (OAF organic acquisition, 2026-11-04). Stable 50/50 split by
// listing slug — no cookies, no client state, no new data; both arms link to the same
// /claim/{slug} flow (unchanged auth + ownership verification). Arm is recorded only through
// the allowlisted claim src: control = detail_unlock_preview, treatment = detail_unlock_v2.
// Primary metric: verified claims per arm (claim_attribution stage='claim' joined to claimed).
export function unlockArm(slug: string): "control" | "v2" {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) { h ^= slug.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % 2 === 1 ? "v2" : "control";
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
  const v2 = unlockArm(listingSlug) === "v2";
  return (
    <Link
      href={`/claim/${listingSlug}?src=${v2 ? "detail_unlock_v2" : "detail_unlock_preview"}`}
      className="mt-8 block rounded-lg border bg-gray-50 p-6 no-underline transition-colors hover:border-gray-400"
    >
      {v2 ? (
        <>
          <p className="font-semibold text-gray-900">Is this your business?</p>
          <p className="mt-1 text-sm text-gray-700">
            Claim it free. Verify with your email in a few minutes. No credit card required.
          </p>
          <p className="mt-3 text-sm font-medium text-gray-900">Claiming unlocks:</p>
        </>
      ) : (
        <p className="font-semibold text-gray-900">Own this business? Claim it free to unlock:</p>
      )}
      <ul className={v2 ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
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
        {v2 ? "Claim this listing, free" : "Claim This Listing"}
      </span>
    </Link>
  );
}
