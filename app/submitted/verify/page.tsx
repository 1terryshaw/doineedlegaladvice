import type { Metadata } from "next";

import { LANE_ACCENT, LANE_ROBOTS, laneOpen } from "@/lib/lane-gate";
import { sha256 } from "@/lib/lane-crypto";
import { peekVerifyToken } from "@/lib/lane-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm your listing", robots: LANE_ROBOTS };

const ERRORS: Record<string, string> = {
  missing: "That link didn't carry a confirmation code.",
  invalid: "We couldn't read that request.",
  expired: "That confirmation link has expired or has already been used. Submit the listing again and we'll send a fresh link.",
  use_the_button: "Please use the Confirm button below — confirming happens when you click, not when a link is opened.",
};

/**
 * THE VERIFY INTERSTITIAL — IT READS, NAMES THE LISTING, AND WRITES NOTHING (spec §4).
 *
 * 🔴 THIS PAGE EXISTS BECAUSE A MAILED LINK MUST NOT BE A WRITER. This repo learned it on its
 * own claim route (`app/api/claim/verify/route.ts:8-34`): the link used to be a GET that
 * wrote, so corporate link-safety rewriters and inbox previewers completed claims on
 * recipients' behalf, and the resulting row was indistinguishable from a genuine claim. A
 * scanner that prefetches this URL renders a page and changes nothing.
 *
 * It is a plain server-rendered `<form>`, so the whole flow works with JavaScript disabled.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = (searchParams.token ?? "").trim();
  const error = searchParams.error ? ERRORS[searchParams.error] ?? ERRORS.invalid : null;

  // The lookup is a READ. It resolves the digest, never the secret, and it is what lets the
  // page name the listing the visitor is about to publish — confirming something unnamed is
  // not consent.
  const pending = laneOpen() && token !== "" ? await peekVerifyToken(sha256(token)) : null;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ color: LANE_ACCENT, fontSize: 26, fontWeight: 700 }}>Confirm your listing</h1>
      {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}

      {pending ? (
        <>
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>
            You&apos;re about to publish a self-submitted listing for{" "}
            <strong>{pending.business_name}</strong>. It will be shown exactly as you submitted
            it, marked as self-submitted and not checked by us, and it will not be indexed by
            search engines.
          </p>
          <form method="post" action="/api/submitted/verify" style={{ marginTop: 24 }}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              style={{ background: LANE_ACCENT, color: "#fff", border: 0, borderRadius: 6, padding: "12px 22px", fontWeight: 600 }}
            >
              Confirm and publish
            </button>
          </form>
        </>
      ) : (
        !error && (
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>
            {/* Deliberately one message for "unknown", "expired" and "already used" — telling
                them apart would let a caller probe which codes are live. */}
            That confirmation link is no longer valid. Submit the listing again and we&apos;ll
            send a fresh one.
          </p>
        )
      )}
    </div>
  );
}
