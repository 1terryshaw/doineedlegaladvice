import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${verticalConfig.name} support.`,
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contact</h1>
      <p className="text-gray-600 mb-8">
        Questions, listing corrections, claim verification, billing — we&apos;ll respond within
        two business days.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-500">Support email</div>
          <a
            href={`mailto:${verticalConfig.supportEmail}`}
            className="text-lg underline"
            style={{ color: verticalConfig.primaryColor }}
          >
            {verticalConfig.supportEmail}
          </a>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Operator</div>
          <div className="text-gray-900">Smart Website Management</div>
        </div>
      </div>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900">
        <p className="font-semibold mb-2">Not a substitute for legal counsel</p>
        <p>
          We can&apos;t answer questions about your specific legal matter, refer you to an
          attorney for representation, or accept service of process through this address. For
          legal advice, retain an attorney licensed in your jurisdiction. For terms governing
          your use of {verticalConfig.name}, see our{" "}
          <Link href="/terms" className="underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
