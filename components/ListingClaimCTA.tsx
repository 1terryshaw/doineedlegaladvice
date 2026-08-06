"use client";

import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { useOwnerAuth } from "@/lib/useOwnerAuth";

interface Props {
  listingSlug: string;
  listingClaimed: boolean;
}

export default function ListingClaimCTA({ listingSlug, listingClaimed }: Props) {
  const { authenticated, slug, loading } = useOwnerAuth({ context: true, listingSlug });

  if (loading) return null;

  // Logged in and this is their listing
  if (authenticated && slug === listingSlug) {
    return (
      <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
        <p className="font-semibold text-green-800">This is your listing</p>
        <Link
          href={`/owner/${slug}/edit`}
          className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: verticalConfig.primaryColor }}
        >
          Edit My Listing
        </Link>
      </div>
    );
  }

  // Logged in but not their listing
  if (authenticated) {
    return null;
  }

  // Not logged in and listing is not claimed
  if (!listingClaimed) {
    return (
      <div className="mt-8 bg-gray-50 border rounded-lg p-6">
        <p className="font-semibold">Is this your business?</p>
        <p className="text-sm text-gray-600 mt-1">Claim this listing to manage it and connect with customers.</p>
        <Link
          href={`/claim/${listingSlug}`}
          className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: verticalConfig.primaryColor }}
        >
          Claim Listing
        </Link>
      </div>
    );
  }

  // Not logged in, listing already claimed
  return null;
}
