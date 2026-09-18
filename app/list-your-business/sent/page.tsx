import type { Metadata } from "next";

import { LANE_ACCENT, LANE_ROBOTS } from "@/lib/lane-gate";

export const metadata: Metadata = { title: "Check your email", robots: LANE_ROBOTS };

export default function SentPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ color: LANE_ACCENT, fontSize: 26, fontWeight: 700 }}>Check your email</h1>
      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        We&apos;ve sent a confirmation link to the address you gave us. Open it and confirm, and
        your listing goes live. Nothing is published until you do.
      </p>
      <p style={{ marginTop: 12, lineHeight: 1.6, color: "#64748b", fontSize: 14 }}>
        The link is valid for 24 hours. If it doesn&apos;t arrive, check your spam folder — and
        if it still isn&apos;t there, just submit the listing again and we&apos;ll send a fresh
        link. We never store a copy of the link, so we can&apos;t re-send the original one.
      </p>
    </div>
  );
}
