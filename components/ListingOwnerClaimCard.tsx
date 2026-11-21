import Link from "next/link";
import PublicGbpClaimSidecar from "@/components/PublicGbpClaimSidecar";

interface Props {
  listingSlug: string;
  businessName: string;
  reviewsVerified: boolean;
  address: string;
}

export default function ListingOwnerClaimCard({ listingSlug, businessName, reviewsVerified, address }: Props) {
  return (
    <section className="rounded-xl border border-emerald-800 bg-emerald-950 p-6 text-white shadow-lg" data-testid="owner-claim-card">
      <h2 className="break-words text-xl font-bold">Own {businessName}?</h2>
      {!reviewsVerified && (
        <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
          Reviews Not Yet Verified
        </span>
      )}
      <ul className="my-5 space-y-3 text-sm leading-6">
        <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>Earn your <strong>Reviews Verified</strong> badge (add your Google Business Profile link)</span></li>
        <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>Add your own business photos</span></li>
        <li className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>Update phone, hours &amp; services anytime</span></li>
      </ul>
      <details className="mb-5 text-sm">
        <summary className="cursor-pointer rounded text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Confirm your Google profile</summary>
        <PublicGbpClaimSidecar listingSlug={listingSlug} listingName={businessName} address={address} listingClaimed={false} />
      </details>
      <Link href={`/claim/${listingSlug}`} rel="nofollow" className="flex min-h-12 w-full items-center justify-center rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950">
        Claim This Listing Free
      </Link>
    </section>
  );
}
