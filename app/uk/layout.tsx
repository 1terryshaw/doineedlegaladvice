import type { Metadata } from "next";
import UkAttribution from "@/components/UkAttribution";

// A3 (2026-07-11): the /uk subtree is Companies House shell data — name + registered
// address only (0 websites, ~0 claims). NOINDEX the whole subtree; rows are kept and the
// live US root stays fully indexable. Reversible: change the robots metadata below to
// re-index /uk — do NOT delete this file, it also renders the MANDATORY OGL attribution.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function UkLayout({ children }: { children: React.ReactNode }) {
  // UkAttribution is an OGL v3.0 LICENCE CONDITION on the Companies House data these pages
  // render, not decoration. It must stay rendered when the robots metadata above is changed
  // for the Step-2 noindex lift. See components/UkAttribution.tsx.
  return (
    <>
      {children}
      <UkAttribution />
    </>
  );
}
