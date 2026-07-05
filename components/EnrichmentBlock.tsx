// Reusable presentation for AI-enriched "Additional Information". Server component (no client JS).
//
// Two separate thresholds, by design:
//  - The API serves any enrichment with >=2 populated fields (machine-facing data threshold).
//  - This component renders a VISIBLE block only when it clears a higher PRESENTATION threshold
//    (a real narrative or genuine differentiation) so pages never look thin. The page's JSON-LD
//    still consumes all grounded fields regardless — machines benefit even when the human block
//    is hidden.
//
// Merge priority (claimed > original > enrichment): gap-fill only. The component is told which
// authoritative fields the listing already shows and never duplicates them.
import type { KnowledgeData } from "@/lib/knowledge";

function dedupeCap(items: string[], cap: number): { shown: string[]; extra: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items ?? []) {
    const s = (raw ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return { shown: out.slice(0, cap), extra: Math.max(0, out.length - cap) };
}

interface Props {
  enrichment: KnowledgeData;
  listingHasDescription: boolean;
  listingHasServices: boolean;
  listingHasServiceArea: boolean;
}

export default function EnrichmentBlock({
  enrichment,
  listingHasDescription,
  listingHasServices,
  listingHasServiceArea,
}: Props) {
  const k = enrichment.knowledge;

  // Gap-fill: only surface what the authoritative listing doesn't already show.
  const description = !listingHasDescription ? (k.description ?? null) : null;
  const services = !listingHasServices ? dedupeCap(k.services, 10) : { shown: [], extra: 0 };
  const areas = !listingHasServiceArea ? dedupeCap(k.service_areas, 5) : { shown: [], extra: 0 };
  const specialties = dedupeCap(k.specialties, 6);
  const certifications = dedupeCap(k.certifications, 6);
  const languages = dedupeCap(k.languages, 6);
  const year = k.year_established && /\d/.test(k.year_established) ? k.year_established : null;
  const teamSize = k.team_size && /\d/.test(k.team_size) ? k.team_size : null;

  // PRESENTATION THRESHOLD — require a narrative. The visible block only renders when it can lead
  // with a real description (the gap-filled value: the enrichment's description when the listing
  // doesn't already provide one). Description-less enrichments are not shown to humans; their data
  // still flows to machines via the page's JSON-LD. Everything below the description is supplementary.
  if (!description) return null;

  const updated = new Date(enrichment.meta.updated_at).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const metaBits = [
    year ? `Established ${year}` : null,
    teamSize ? `Team of ${teamSize}` : null,
    languages.shown.length > 0 ? `Languages: ${languages.shown.join(", ")}` : null,
    areas.shown.length > 0 ? `Serving ${areas.shown.join(", ")}${areas.extra > 0 ? ` +${areas.extra} more` : ""}` : null,
  ].filter((s): s is string => Boolean(s));

  return (
    <section className="mt-8 border-t pt-6" aria-label="Additional Information">
      <h3 className="font-semibold mb-3 text-gray-900">Additional Information</h3>

      {description && (
        <p className="text-[15px] leading-relaxed text-gray-700 mb-4">{description}</p>
      )}

      {certifications.shown.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {certifications.shown.map((c) => (
            <span
              key={c}
              className="inline-flex items-center bg-teal-50 text-teal-800 border border-teal-200 text-xs font-medium rounded-full px-2.5 py-1"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {specialties.shown.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Specializes in</h4>
          <div className="flex flex-wrap gap-2">
            {specialties.shown.map((s) => (
              <span key={s} className="bg-blue-50 text-blue-800 text-sm rounded-full px-3 py-1">{s}</span>
            ))}
          </div>
        </div>
      )}

      {services.shown.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Services</h4>
          <div className="flex flex-wrap items-center gap-2">
            {services.shown.map((s) => (
              <span key={s} className="bg-gray-100 text-gray-700 text-sm rounded-full px-3 py-1">{s}</span>
            ))}
            {services.extra > 0 && <span className="text-gray-400 text-sm">+{services.extra} more</span>}
          </div>
        </div>
      )}

      {metaBits.length > 0 && (
        <p className="text-sm text-gray-600 mb-3">{metaBits.join("  ·  ")}</p>
      )}

      <p className="text-xs text-gray-400">
        Additional information extracted from the firm&apos;s public website. Last updated: {updated}
      </p>
    </section>
  );
}
