import { redirect } from "next/navigation";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import { listPhotosForListing } from "@/lib/listing-photos";
import { BUCKET } from "@/lib/owner-form-bucket";
import OwnerEditForm from "@/components/OwnerEditForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Edit Listing",
};

export default async function OwnerEditPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect("/owner/login");
  }

  const { photos, logo } = await listPhotosForListing(result.listing.id);
  const lst = result.listing as Record<string, unknown>;

  // Bucket-aware reads: pull whichever column actually exists for this repo.
  const initialName = (typeof lst[BUCKET.nameColumn] === "string"
    ? (lst[BUCKET.nameColumn] as string)
    : "");
  const initialProvince = (typeof lst[BUCKET.provinceColumn] === "string"
    ? (lst[BUCKET.provinceColumn] as string)
    : "");

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <OwnerEditForm
        listing={result.listing}
        initialName={initialName}
        initialProvince={initialProvince}
        initialPhotos={photos}
        initialLogo={logo}
      />
    </div>
  );
}
