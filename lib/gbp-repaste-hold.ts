// owner-funnel-recovery-p1p4-v1 P2 (2026-09-26): the ONLY listings that get the "please re-paste your Google
// link" prompt — an ALLOW-list of this repo's still-impaired rows from the 13-owner census (url on file, no
// place id, owner pasted before paste-time resolve). Protected cohorts and suppressed owners are list-only and
// never appear here; any other listing sees a neutral line. Source: programs/ofr-evidence/p2-review-inert-30.json.
export const REPASTE_PROMPT: ReadonlySet<string> = new Set<string>([]);
