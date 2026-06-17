// components/uk/RegulatorBadge.tsx — three-jurisdiction regulator badge.
// Text only — no logo files, no external image URLs (empire copyright rule: avoid
// regulator seals even if open). Solicitor /uk has three regulators (vs accountant's one).
import { REGULATOR_BY_JURISDICTION, type UkJurisdiction } from "@/lib/uk-solicitors";

export default function RegulatorBadge({
  jurisdiction,
  variant = "full",
}: {
  jurisdiction: UkJurisdiction | null;
  variant?: "full" | "compact";
}) {
  if (!jurisdiction) return null;
  const b = REGULATOR_BY_JURISDICTION[jurisdiction];
  return (
    <span
      className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded-full"
      aria-label={`Regulated by the ${b.full}`}
      title={`Regulated by the ${b.full}`}
    >
      <strong className="font-semibold">{b.acronym}</strong>
      {variant === "full" && (
        <span className="text-slate-500">Regulated by the {b.full}</span>
      )}
    </span>
  );
}

// For a hub page: derive the page-level jurisdiction from the firms on it. If all firms
// agree, return that jurisdiction; if mixed (shouldn't happen at county level), return null
// so the caller can show a "see firm card for regulator" note.
export function dominantJurisdiction(
  firms: Array<{ jurisdiction: UkJurisdiction | null }>
): UkJurisdiction | null {
  const set = new Set(firms.map((f) => f.jurisdiction).filter(Boolean));
  return set.size === 1 ? (Array.from(set)[0] as UkJurisdiction) : null;
}
