import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import OwnerDashboard from "@/components/OwnerDashboard";
import ReviewShowcase from "@/components/ReviewShowcase";
import HealthScore from "@/components/HealthScore";
import { listPhotosForListing } from "@/lib/listing-photos";
import { computeListingHealth } from "@/lib/listing-health";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Owner Dashboard",
};

export default async function OwnerDashboardPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect("/owner/login");
  }

  const { listing } = result;
  const lst = listing as typeof listing & {
    google_place_id?: string;
    google_rating?: number;
    google_review_count?: number;
  };
  const reviewSlot = lst.google_place_id ? (
    <ReviewShowcase
      googlePlaceId={lst.google_place_id}
      subscriptionTier={
        (listing.subscription_tier || listing.tier || "free") as
          | "free"
          | "reviews_plus"
          | "reviews"
          | "website"
          | "growth"
      }
      fallbackRating={lst.google_rating}
      fallbackCount={lst.google_review_count}
    />
  ) : null;

  const { photos } = await listPhotosForListing(listing.id);
  const healthSlot = (
    <HealthScore health={computeListingHealth(listing, photos.length)} />
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <OwnerDashboard listing={listing} reviewSlot={reviewSlot} healthSlot={healthSlot} />
    </div>
  );
}
