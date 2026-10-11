import { Metadata } from "next";
import Link from "next/link";
import { getListingForClaim } from "@/lib/supabase";
import ClaimForm from "@/components/ClaimForm";
import { NAME_EMAIL_REASON, NAME_EMAIL_MESSAGE } from "@/lib/name-email-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim Error",
  robots: { index: false, follow: false },
};

interface Props {
  // /api/claim/verify carries ?slug= on every failure path it knows the listing for.
  searchParams: Promise<{ reason?: string; slug?: string }>;
}

export default async function ClaimErrorPage({ searchParams }: Props) {
  const { slug, reason } = await searchParams;
  // name-guard-followthrough-v1 (K395 R1): the claim write was refused by the name-email guard.
  const nameEmail = reason === NAME_EMAIL_REASON;
  // A verify link dies for one ordinary reason: the owner submitted the claim again and the
  // newer request rotated the token out from under the older email. Ending that at "back to
  // directory" strands a real owner mid-claim. When we know which listing they were claiming
  // and it is still claimable, hand them a fresh link instead of a dead end.
  // getListingForClaim() is the same claim-context read /claim/[slug] uses, so a DARK (unpublished)
  // unclaimed row — whose /directory page is a 410 — still gets the re-claim form instead of a
  // dead end. A missing row falls back to the terminal copy; the claimed check is unchanged. The ClaimForm props below mirror that page — this repo's own reference impl.
  const listing = slug ? await getListingForClaim(slug) : null;
  const resendable = !!listing && !listing.claimed;

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
        <p className="text-gray-600 mb-6">
          {nameEmail
            ? NAME_EMAIL_MESSAGE
            : resendable
            ? "That verification link is no longer valid — starting the claim again replaces the previous link. Request a fresh one below and it will be emailed to you."
            : "The verification link is invalid or has expired. Please try claiming your listing again."}
        </p>
      </div>

      {!nameEmail && resendable && (
        <div className="border-t pt-8">
          <ClaimForm
            listingSlug={listing!.slug}
            listingName={listing!.name}
          />
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/directory" className="text-blue-600 hover:underline">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
