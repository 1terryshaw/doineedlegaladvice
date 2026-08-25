// components/uk/RegulatorBadge.tsx — regulatory claim REMOVED (renders nothing).
//
// 2026-08-25 — this component used to render "SRA / LSS / LSNI · Regulated by the
// <full name>" on every /uk solicitor page. Its only gate was `jurisdiction`, which is
// the postcodes.io COUNTRY of the firm's registered office — not a register match. The
// seeder derives it mechanically (`regulatorFor(jurisdictionFromCountry(...))`) and
// hardcodes `regulator_id: null`, so the register id was never wired: 16,450 published
// rows carried the claim, 0 were matched to an SRA/LSS/LSNI register. A firm's postcode
// being in Scotland is not evidence that the Law Society of Scotland has registered it.
// The underlying rows come from self-declared Companies House SIC codes (69102/69109).
// A SIC classification is not a registration. Recon: uk-regulator-label-recon-2026-08-25.
//
// It renders NULL rather than being deleted so all four call sites (detail, county hub,
// town hub, UkListingCard) compile and revert unchanged, and so there is one obvious
// place to reinstate an HONEST claim if register data is ever acquired: gate it on a real
// per-row `regulator_id`, the way doineedavet gates its accreditation chip on a real
// `rcvs_status`. Do NOT reinstate a claim derived from `jurisdiction`.
//
// The `jurisdiction` prop is still read (and the DATA COLUMN is untouched — it remains
// accurate AS A JURISDICTION); it simply no longer renders a regulatory claim. The old
// `compact` variant hid the visible sentence but kept the assertion in `title` and
// `aria-label` — shortening the badge was never a fix.
import { type UkJurisdiction } from "@/lib/uk-solicitors";

export default function RegulatorBadge({}: {
  jurisdiction: UkJurisdiction | null;
  variant?: "full" | "compact";
}) {
  return null;
}

// Retained: the county/town hubs import this to derive a page-level jurisdiction from the
// firms on the page. If all firms agree, return that jurisdiction; if mixed, return null.
// It is a jurisdiction helper, not a regulator claim.
export function dominantJurisdiction(
  firms: Array<{ jurisdiction: UkJurisdiction | null }>
): UkJurisdiction | null {
  const set = new Set(firms.map((f) => f.jurisdiction).filter(Boolean));
  return set.size === 1 ? (Array.from(set)[0] as UkJurisdiction) : null;
}
