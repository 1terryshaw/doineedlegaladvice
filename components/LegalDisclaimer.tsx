"use client";

import { usePathname } from "next/navigation";

export default function LegalDisclaimer() {
  const pathname = usePathname();
  const isUK = pathname?.startsWith("/uk") ?? false;

  if (isUK) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
        <span className="text-amber-600 text-xl flex-shrink-0" aria-hidden="true">
          &#9888;&#65039;
        </span>
        <p className="text-sm text-amber-800">
          <strong>Disclaimer:</strong> DoINeedLegalAdvice.com provides general legal information only.
          This is not legal advice and does not create a solicitor–client relationship. Always consult
          with a qualified solicitor for advice specific to your situation.
        </p>
      </div>
    );
  }

  // EXISTING US/CA TEXT — preserved byte-for-byte.
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
      <span className="text-amber-600 text-xl flex-shrink-0" aria-hidden="true">
        &#9888;&#65039;
      </span>
      <p className="text-sm text-amber-800">
        <strong>Disclaimer:</strong> DoINeedLegalAdvice.com provides general legal information only.
        This is not legal advice and does not create an attorney-client relationship. Always consult
        with a qualified attorney for advice specific to your situation.
      </p>
    </div>
  );
}
