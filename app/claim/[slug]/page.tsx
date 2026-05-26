import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListing } from "@/lib/supabase";
import ClaimForm from "@/components/ClaimForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Claim Listing",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({ params }: Props) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  if (listing.claimed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Already Claimed</h1>
        <p className="text-gray-600">This listing has already been claimed by its owner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <ClaimForm listingSlug={listing.slug} listingName={listing.name} />
    </div>
  );
}
