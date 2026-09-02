import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingForClaim } from "@/lib/supabase";
import ClaimForm from "@/components/ClaimForm";
import RemovalRequestButton from "@/components/RemovalRequestButton";
import { evaluateRepublish } from "@/lib/republish-guard";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim Listing",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListingForClaim(slug);
  if (!listing) notFound();

  if (listing.claimed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Already Claimed</h1>
        <p className="text-gray-600">This listing has already been claimed by its owner.</p>
      </div>
    );
  }

  // gone-page-claim-link-v1 (K148, ruling 2026-09-02): a de-served row whose deserve_reason the
  // republish guard DENIES (RESTRICTED_SOURCE_TERMS et al.) stays unpublished after a claim.
  // Say so before the form, using the guard's own predicate — never a duplicated string list.
  const { deserve_reason, is_published, name: rowName } = listing as {
    deserve_reason?: string | null;
    is_published?: boolean | null;
    name: string | null;
  };
  const staysUnpublished =
    is_published === false &&
    evaluateRepublish({ is_published, deserve_reason, name: rowName }).reason_code ===
      "DENY_restricted_or_unmapped";

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      {staysUnpublished && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This listing was sourced from a restricted register and will stay unpublished after you
          claim it. Claiming gives you owner access and the ability to update or remove the record.
        </div>
      )}
      <ClaimForm listingSlug={listing.slug} listingName={listing.name} />
      {/* Copy's "remove it, if you'd rather not be listed" bullet — human-reviewed request. */}
      <div className={staysUnpublished ? "mt-6 text-center" : "mt-8 text-center"}>
        <RemovalRequestButton listingSlug={listing.slug} listingId={String(listing.id)} />
      </div>
    </div>
  );
}
