"use client";

import { usePathname } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";

// Renders the footer tagline. On /uk paths it reads "solicitor"; everywhere else it
// renders verticalConfig.description verbatim (US/CA byte-identical visible text).
export default function FooterTagline() {
  const pathname = usePathname();
  const isUK = pathname?.startsWith("/uk") ?? false;
  if (isUK) {
    return <>AI-driven legal triage. Describe your situation, get matched to the right type of solicitor.</>;
  }
  return <>{verticalConfig.description}</>;
}
