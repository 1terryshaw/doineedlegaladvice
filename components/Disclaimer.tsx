"use client";

import { usePathname } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";

export default function Disclaimer() {
  const pathname = usePathname();
  const isUK = pathname?.startsWith("/uk") ?? false;

  if (isUK) {
    return (
      <div
        role="note"
        aria-label="Legal disclaimer"
        className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm py-2 px-4 text-center"
      >
        <span className="font-semibold">Disclaimer:</span>{" "}
        This is not legal advice. No solicitor–client relationship is formed by using this directory.
        {verticalConfig.name} is an information service only — always consult a qualified solicitor
        regulated by the SRA, the Law Society of Scotland, or the Law Society of Northern Ireland, as
        applicable, for advice on your specific situation.
      </div>
    );
  }

  // EXISTING US/CA TEXT — preserved byte-for-byte (out-of-scope typo not touched).
  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm py-2 px-4 text-center"
    >
      <span className="font-semibold">Disclaimer:</span>{" "}
      This is not legal advice. No attorney-client relationship is formed by using this directory.
      {verticalConfig.name} is an information service only — always consult a qualified attorney
      licensed in your jurisdiction for advice on your specific situation.
    </div>
  );
}
