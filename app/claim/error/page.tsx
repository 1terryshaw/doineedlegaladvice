import { Metadata } from "next";
import Link from "next/link";
import { getListing } from "@/lib/supabase";
import ClaimForm from "@/components/ClaimForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim Error",
  robots: { index: false, follow: false },
};

interface Props {
  // /api/claim/verify carries ?slug= on every failure path it knows the listing for.
  searchParams: Promise<{ slug?: string }>;
}

export default async function ClaimErrorPage({ searchParams }: Props) {
  const { slug } = await searchParams;
  // A verify link dies for one ordinary reason: the owner submitted the claim again and the
  // newer request rotated the token out from under the older email. Ending that at "back to
  // directory" strands a real owner mid-claim. When we know which listing they were claiming
  // and it is still claimable, hand them a fresh link instead of a dead end.
  // getListing() is the same read the /claim/[slug] page uses, so an unpublished or missing
  // row falls back to the terminal copy rather than offering a claim we would not otherwise
  // serve. The ClaimForm props below mirror that page — this repo's own reference impl.
  const listing = slug ? await getListing(slug) : null;
  const resendable = !!listing && !listing.claimed;

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
        <p className="text-gray-600 mb-6">
          {resendable
            ? "That verification link is no longer valid — starting the claim again replaces the previous link. Request a fresh one below and it will be emailed to you."
            : "The verification link is invalid or has expired. Please try claiming your listing again."}
        </p>
      </div>

      {resendable && (
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
