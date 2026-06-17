"use client";

import { usePathname } from "next/navigation";
import { organizationSchema } from "@/lib/seo";

// Site-wide Organization JSON-LD. On /uk paths the description reads "solicitor";
// everywhere else it renders the existing schema verbatim. Client component, but
// SSR-rendered on first load so the <script> is present in the initial HTML for crawlers.
export default function OrgJsonLd() {
  const pathname = usePathname();
  const isUK = pathname?.startsWith("/uk") ?? false;
  const schema = organizationSchema() as Record<string, unknown>;
  if (isUK) {
    schema.description =
      "Find a UK solicitor — matched to the right type of solicitor regulated by the SRA, the Law Society of Scotland, or the Law Society of Northern Ireland.";
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
