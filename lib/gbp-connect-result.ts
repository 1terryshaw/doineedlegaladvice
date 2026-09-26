// owner-funnel-recovery-p1p4-v1 P2 (2026-09-26) — the ONE mapping from a /api/owner/gbp-connect
// response to what the owner is told. Every paste ends in exactly one honest outcome; nothing fails
// silently. Owner-facing words are plain: success opens with "Connected to Google — …" (the three ruled status phrases) — never
// "Google verified". The other listing's identity is never exposed on already_linked.
// Every lib/gbp-chij-resolve ChijOutcome is mapped explicitly (independent review P2 #4/#5).
// owner-journey-friction-fix-v1 B (ruling 1): success messages use the three Google status phrases.
export type GbpConnectOutcome =
  | "connected_review_ready"         // ChIJ — the rating/reviews features can work
  | "connected_not_yet_review_ready" // feature-id kept; Google's review data not matched yet
  | "already_linked"                 // that Google profile is linked to another listing (409, or ChIJ collision)
  | "couldnt_read_link"              // 400 — not a usable Google link (with what to paste instead)
  | "temporarily_cant_check"         // Google/quota unavailable right now; retry later
  | "not_saved";                     // auth / server failure — nothing changed

export const GBP_PASTE_HINT =
  "On Google Maps, open your business, tap Share, then Copy link, and paste that link here.";

// ChIJ-upgrade outcomes that mean "we could not ask Google right now" (daily cap, key, upstream).
const TEMPORARY_CHIJ = new Set(["refused_rate_limited", "refused_unconfigured", "error_places"]);
// ChIJ-upgrade outcomes where a different share link may help.
const REPASTE_CHIJ = new Set(["refused_no_anchor", "refused_unresolved", "not_attempted"]);
const TEMPORARY_STATUS = new Set([429, 502, 503, 504]);

export function gbpConnectResult(
  status: number,
  data: { ok?: boolean; placeId?: unknown; chij?: unknown; error?: unknown; message?: unknown } | null,
): { outcome: GbpConnectOutcome; message: string } {
  const d = data ?? {};
  // Success needs a parsed body with a real place id — never label a half-response "connected".
  if (status >= 200 && status < 300 && data && d.ok !== false && typeof d.placeId === "string" && d.placeId) {
    if (d.placeId.startsWith("ChIJ")) {
      return { outcome: "connected_review_ready", message: "Connected to Google — your rating will show once Google shares it" };
    }
    if (d.chij === "refused_collision") {
      return {
        outcome: "already_linked",
        message: "Connected to Google — your rating will show once Google shares it. Your link is saved, but that Google profile's reviews are already linked to another business in our directory, so they can't show here yet. If it belongs to you, contact support and we'll sort it out.",
      };
    }
    if (typeof d.chij === "string" && TEMPORARY_CHIJ.has(d.chij)) {
      return {
        outcome: "temporarily_cant_check",
        message: "Connected to Google — your rating will show once Google shares it. We couldn't check it with Google right now, so reviews aren't on yet. Please try pasting it again later.",
      };
    }
    return {
      outcome: "connected_not_yet_review_ready",
      message: "Connected to Google — your rating will show once Google shares it. We couldn't match it to Google's review data yet, so reviews won't show for now." +
        (typeof d.chij !== "string" || REPASTE_CHIJ.has(d.chij) ? " " + GBP_PASTE_HINT : ""),
    };
  }
  if (status === 409 || d.error === "already_linked") {
    return {
      outcome: "already_linked",
      message: "That Google listing is already linked to another business in our directory. If it belongs to you, contact support and we'll sort it out.",
    };
  }
  if (TEMPORARY_STATUS.has(status) || d.error === "resolver_timeout") {
    return { outcome: "temporarily_cant_check", message: "Google didn't answer in time. Nothing was changed — please try again in a few minutes." };
  }
  if (status === 400) {
    const base = typeof d.message === "string" && d.message ? d.message.split(" Tip:")[0] : "We couldn't read that link.";
    return { outcome: "couldnt_read_link", message: `${base} ${GBP_PASTE_HINT}` };
  }
  if (status >= 200 && status < 300) {
    // 2xx but no usable body: the write may have happened — say so honestly instead of "nothing changed".
    return { outcome: "not_saved", message: "We couldn't confirm the connection. Please refresh the page to see whether your Google link is saved." };
  }
  const msg = typeof d.message === "string" && d.message ? d.message : "We could not connect Google. Nothing was changed — please try again.";
  return { outcome: "not_saved", message: msg };
}
