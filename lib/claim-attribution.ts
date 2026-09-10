// Server-side claim-attribution source allowlist. These are the ONLY values that
// may ever be written to claim_attribution.src. Each is a FIXED per-surface literal
// set by our own code — never user/client-supplied free text. Anything not exactly
// matching a member (missing, tampered, a URL/id/email) normalizes to "unknown" so no
// raw value is stored.
export const CLAIM_SRC_ALLOWLIST = new Set<string>([
  "header_cta",
  "claim_hub_existing",
  "detail_unlock_preview",
  "gbp_helper",
  "direct_claim",
  "add_business",
  "dashboard_claim_another",
  "lead", // legacy lead-to-claim pitch (?src=lead, TDL #472) — a real source, kept as-is
  // outreach-attribution-fix-v1 (2026-09-02, K153): outreach + gone-page email/link sources.
  "cold_outreach_e1", // cold E1/E2/E3 CTA → /claim/<slug>?src=cold_outreach_e1 (empire-outreach.ts buildClaimUrl)
  "invite",           // K38 invite email → /claim/<slug>?src=invite (empire-outreach.ts getInviteEmail)
  "gone_page",        // de-served 410 page → /claim/<slug>?src=gone_page (deserve_gate v1.1.0, K148)
  "cold_outreach_e2", // cold E2 follow-up CTA (claim-src-attribution-v1, 2026-09-10)
  "cold_outreach_e3", // cold E3 follow-up CTA (claim-src-attribution-v1, 2026-09-10)
  "unknown",
]);

// Normalize an inbound src to a strict allowlist member; everything else -> "unknown".
// Returns a literal from CLAIM_SRC_ALLOWLIST only — never the raw input.
export function normalizeClaimSrc(raw: unknown): string {
  return typeof raw === "string" && CLAIM_SRC_ALLOWLIST.has(raw) ? raw : "unknown";
}
