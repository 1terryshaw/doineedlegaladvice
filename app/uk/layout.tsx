import type { Metadata } from "next";

// A3 (2026-07-11): the /uk subtree is Companies House shell data — name + registered
// address only (0 websites, ~0 claims). NOINDEX the whole subtree; rows are kept and the
// live US root stays fully indexable. Reversible: delete this file to re-index /uk.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function UkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
