import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Claim Error",
};

export default function ClaimErrorPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
      <p className="text-gray-600 mb-6">
        The verification link is invalid or has expired. Please try claiming your listing again.
      </p>
      <Link
        href="/directory"
        className="text-blue-600 hover:underline"
      >
        Back to directory
      </Link>
    </div>
  );
}
