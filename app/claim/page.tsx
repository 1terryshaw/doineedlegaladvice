import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: `Claim Your Listing — ${verticalConfig.name}`,
  description: `Are you a lawyer listed on ${verticalConfig.name}? Claim your listing to manage your profile, respond to inquiries, and connect with potential clients.`,
};

export default function ClaimLandingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">Claim Your Listing</h1>
      <p className="text-gray-600 mb-6">
        Are you a {verticalConfig.listingNoun} listed on {verticalConfig.name}?
        Claiming your listing lets you manage your profile, respond to client
        inquiries, and upgrade your plan for greater visibility.
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 mb-8">
        <h2 className="font-semibold text-lg mb-3">How to Claim Your Listing</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>
            <Link href="/directory" className="underline" style={{ color: verticalConfig.primaryColor }}>
              Browse the directory
            </Link>{" "}
            and find your listing.
          </li>
          <li>
            Click the <strong>&ldquo;Claim Listing&rdquo;</strong> button on your listing page.
          </li>
          <li>Verify your identity via email.</li>
          <li>Once verified, you can manage your profile and respond to inquiries.</li>
        </ol>
      </div>

      <Link
        href="/directory"
        className="inline-block px-6 py-3 rounded-lg text-white font-medium"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Browse the Directory
      </Link>
    </div>
  );
}
