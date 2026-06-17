import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUkFirmForClaim } from "@/lib/uk-solicitors";
import UkClaimForm from "@/components/uk/UkClaimForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Claim Listing",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function UkClaimPage({ params }: Props) {
  const { slug } = await params;
  const firm = await getUkFirmForClaim(slug);
  if (!firm) notFound();

  if (firm.is_claimed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Already Claimed</h1>
        <p className="text-gray-600">
          This listing has already been claimed and verified by its owner.
        </p>
        <Link
          href={`/uk/directory/${slug}`}
          className="inline-block mt-6 text-sm text-gray-500 hover:underline"
        >
          ← Back to listing
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <UkClaimForm slug={firm.id} firmName={firm.business_name} />
      <div className="mt-6 text-center">
        <Link
          href={`/uk/directory/${slug}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← Back to listing
        </Link>
      </div>
    </div>
  );
}
