import React from "react";
import Link from "next/link";

export default function PracticeSearchNotice({ term }: { term: string }) {
  return (
    <aside className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="note">
      We don&apos;t have practice-area data for lawyers yet, so we can&apos;t filter by &quot;{term}&quot;. Results below only match business names.{" "}
      <Link href="/#triage" className="font-semibold underline underline-offset-2">Try the Triage Helper</Link>
    </aside>
  );
}
