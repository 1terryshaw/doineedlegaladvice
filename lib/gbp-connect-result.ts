// owner-funnel-recovery-p1p4-v1 P2 (2026-09-26) — the ONE mapping from a /api/owner/gbp-connect
// response to what the owner is told. Every paste ends in exactly one honest outcome; nothing fails
// silently. Owner-facing words are plain: "✓ Google connected" is the only success label — never
// "Google verified". The other listing's identity is never exposed on already_linked.
export type GbpConnectOutcome =
  | "connected_review_ready"         // ChIJ — the rating/reviews features can work
  | "connected_not_yet_review_ready" // feature-id kept; Google's review data not matched yet
  | "already_linked"                 // 409 — that profile is linked to another listing
  | "couldnt_read_link"              // 400 — not a usable Google link (with what to paste instead)
  | "temporarily_cant_check"         // Google/quota unavailable right now; retry later
  | "not_saved";                     // auth / server failure — nothing changed

export const GBP_PASTE_HINT =
  "On Google Maps, open your business, tap Share, then Copy link, and paste that link here.";

// ChIJ-upgrade outcomes that mean "we could not ask Google right now" (quota, key, upstream).
const TEMPORARY_CHIJ = new Set(["refused_rate_limited", "refused_unconfigured", "error_places"]);

export function gbpConnectResult(
  status: number,
  data: { ok?: boolean; placeId?: unknown; chij?: unknown; error?: unknown; message?: unknown } | null,
): { outcome: GbpConnectOutcome; message: string } {
  const d = data ?? {};
  if (status >= 200 && status < 300 && d.ok !== false) {
    if (typeof d.placeId === "string" && d.placeId.startsWith("ChIJ")) {
      return { outcome: "connected_review_ready", message: "✓ Google connected. Your Google rating can show on your listing." };
    }
    if (typeof d.chij === "string" && TEMPORARY_CHIJ.has(d.chij)) {
      return {
        outcome: "temporarily_cant_check",
        message: "✓ Google connected — your link is saved. We couldn't check it with Google right now, so reviews aren't on yet. Please try pasting it again later.",
      };
    }
    return {
      outcome: "connected_not_yet_review_ready",
      message: "✓ Google connected — your link is saved. We couldn't match it to Google's review data yet, so reviews won't show for now. " + GBP_PASTE_HINT,
    };
  }
  if (status === 409 || d.error === "already_linked") {
    return {
      outcome: "already_linked",
      message: "That Google listing is already linked to another business in our directory. If it belongs to you, contact support and we'll sort it out.",
    };
  }
  if (d.error === "resolver_timeout") {
    return { outcome: "temporarily_cant_check", message: "Google took too long to answer. Nothing was changed — please try again in a few minutes." };
  }
  if (status === 400) {
    const base = typeof d.message === "string" && d.message ? d.message.split(" Tip:")[0] : "We couldn't read that link.";
    return { outcome: "couldnt_read_link", message: `${base} ${GBP_PASTE_HINT}` };
  }
  const msg = typeof d.message === "string" && d.message ? d.message : "We could not connect Google. Nothing was changed — please try again.";
  return { outcome: "not_saved", message: msg };
}
