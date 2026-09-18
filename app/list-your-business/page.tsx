import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SubmitListingForm from "@/components/SubmitListingForm";
import { LANE_ACCENT, LANE_NOTICE_BG, LANE_NOTICE_BORDER, LANE_ROBOTS, laneOpen } from "@/lib/lane-gate";

export const metadata: Metadata = {
  title: "Add your business",
  description: "Add your business to the directory as a self-submitted listing.",
  // The intake page itself is `noindex, follow` for the same reason the listings are: this is
  // not a page the directory's index is about.
  robots: LANE_ROBOTS,
};

export default function ListYourBusinessPage() {
  // The flag gates the FRONT DOOR. Before it flips, the route exists and answers cleanly with a
  // 404 rather than a half-built form — which is what makes §8.5 step 4 (deploy with the flag
  // still false) a safe, observable state rather than a leak.
  if (!laneOpen()) notFound();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 64px" }}>
      <aside
        role="note"
        style={{ background: LANE_NOTICE_BG, borderLeft: `4px solid ${LANE_NOTICE_BORDER}`, padding: "16px 20px", marginBottom: 24 }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>Self-submitted listings are not verified.</p>
        <p style={{ margin: "8px 0 0" }}>
          What you submit here is published as you supply it. We do not check it, it is not a
          licensed-attorney credential, and it shows no rating or badge. Self-submitted listings
          are not indexed by search engines.
        </p>
      </aside>
      <h1 style={{ color: LANE_ACCENT, fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
        Add your business
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 }}>
        If we already hold a record for your business, we&apos;ll point you to it instead of
        creating a second one.
      </p>
      <SubmitListingForm />
    </div>
  );
}
