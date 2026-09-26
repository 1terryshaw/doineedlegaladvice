import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import OwnerDashboard from "@/components/OwnerDashboard";
import ReviewShowcase from "@/components/ReviewShowcase";
import HealthScore from "@/components/HealthScore";
import { listPhotosForListing } from "@/lib/listing-photos";
import { computeListingHealth } from "@/lib/listing-health";
import NextStepCard from "@/components/NextStepCard";
import { deriveNextStep } from "@/lib/owner-next-step";
import { addressEditClass, addressEditAllowed } from "@/lib/owner-location-edit";
import ReviewKit from "@/components/ReviewKit";
import { buildReviewKit, reviewKitPlaceId } from "@/lib/review-kit";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

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

  // owner-next-step-card-canary-v1: one action, derived read-only from this row.
  const row = listing as Record<string, unknown>;
  // owner-canary-fixes-and-review-kit-v1: the review kit, for a Google-connected (ChIJ) row only.
  const kitPlaceId = reviewKitPlaceId(row.google_place_id as string | null);
  const reviewKit = kitPlaceId ? buildReviewKit(kitPlaceId) : null;
  const nextStep = deriveNextStep(
    {
      slug: listing.slug,
      phone: row.phone as string | null,
      website: row.website as string | null,
      hours_json: row.hours_json,
      description: row.description as string | null,
      address: row.address as string | null,
      show_address: row.show_address as boolean | null,
      google_place_id: row.google_place_id as string | null,
      google_review_count: row.google_review_count as number | null,
    },
    photos.length,
    {
      addressEditable: addressEditAllowed(await addressEditClass(row.source as string | null)),
      photosSupported: true,
      reviewKit: !!reviewKit,
    },
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <OwnerDashboard
        listing={listing}
        reviewSlot={reviewSlot}
        healthSlot={healthSlot}
        nextStepSlot={
          <>
            <NextStepCard step={nextStep} />
            {reviewKit && <ReviewKit kit={reviewKit} slug={listing.slug} />}
          </>
        }
      />
    </div>
  );
}
