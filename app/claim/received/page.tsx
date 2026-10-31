import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

// TDL #1372: where /api/claim/verify sends a verified claim on a K38-held listing. The claim is recorded and
// queued for an identity check (pending_identity); the listing stays unpublished until that check is done.
export const metadata: Metadata = {
  title: "Claim Received",
  robots: { index: false, follow: false },
};

export default function ClaimReceivedPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Claim received</h1>
        <p className="text-gray-600 mb-6">
          Thanks — we&apos;ve received your claim and verified your email address. We&apos;ll confirm it&apos;s you
          before your listing goes live, and we&apos;ll email you when it does.
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link href="/directory" className="text-blue-600 hover:underline">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
