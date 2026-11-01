// legal-consolidation.ts — TDL #1402. STAMPED, byte-identical in freelawyeradvice + doineedlegaladvice.
//
// Consolidation is ROUTING over canonical legal_listings rows, not copying (K-doc
// legal-help-navigator). DINLA (doineedlegaladvice.com) is canonical; CA provinces are
// switched onto DINLA one batch at a time. A province listed here is:
//   - served on DINLA (country='CA' AND province_state IN this list, published rows only), and
//   - eligible for per-URL 301s from FLA (only URLs in FLA's verified redirect map).
// Order of operations per batch: DINLA deploy READY → verify DINLA targets 200 → FLA map.
// Empty list ⇒ the pre-mission US/CA split, exactly.
export const CA_SERVED_ON_DINLA: string[] = ["NT", "PE", "NL", "MB", "NS", "SK", "NB", "QC", "AB", "BC", "ON"]; // b1 NT; b2 PE NL MB NS; b3 SK NB (2026-11-01, #1402); b4 QC AB BC ON (2026-11-01, #1407 CEO R2)
