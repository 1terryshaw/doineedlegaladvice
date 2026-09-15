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
  /** The listing's OWN description text. Optional: when omitted the component cannot compare,
   *  so it falls back to the old gap-fill behaviour rather than risk a duplicated paragraph. */
  listingDescription?: string | null;
  listingHasServices: boolean;
  listingHasServiceArea: boolean;
}

/** Normalized word tokens, for the restatement check below. */
function words(s: string | null | undefined): string[] {
  return (s ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Does the enrichment's description merely RESTATE the listing's own?
 *
 * WHY THIS EXISTS. The always-on flip below renders the enrichment description on pages that
 * already show the listing's own. On most verticals the two texts are genuinely different
 * (measured median Jaccard 0.14-0.19) because the enrichment is a grounded summary of the
 * business's website. But on the bookkeeper/accountant tables the listing description was
 * itself seeded from the same website's meta-description the enrichment then grounded on, so
 * the model reproduced it -- e.g. an EY listing whose stored description and enrichment open
 * with the same 65 characters. Rendering both is visible duplicate content, on the two cohorts
 * carrying 83% of the flip yield and already -64% demoted.
 *
 * THE TEST IS DELIBERATELY GENEROUS, because suppressing is EXACTLY today's behaviour: a
 * suppressed row renders what it renders now (nothing from this block). A false positive costs
 * zero; a false negative ships a duplicated paragraph. So the asymmetry is resolved in favour
 * of suppressing. Measured fire rate: 35.7% on bookkeeper and 39.2% on accountant, 0.3-8% on
 * every other cohort -- it is close to inert wherever the provenance is not shared.
 */
function restatesListing(enrichDesc: string, listingDesc: string | null | undefined): boolean {
  const le = words(listingDesc);
  const ee = words(enrichDesc);
  if (le.length === 0 || ee.length === 0) return false;
  const nl = le.join(" ");
  const ne = ee.join(" ");
  if (nl.includes(ne) || ne.includes(nl)) return true;            // one wholly restates the other
  if (le.length >= 6 && ee.length >= 6 &&
      le.slice(0, 6).join(" ") === ee.slice(0, 6).join(" ")) return true;  // same verbatim opening
  const B = new Set(ee);
  const seen = new Set<string>();
  let inter = 0;
  for (let i = 0; i < le.length; i++) {                           // iterate the ARRAY, never the
    const w = le[i];                                              // Set: these repos target ES5
    if (seen.has(w)) continue;                                    // and --downlevelIteration is off
    seen.add(w);
    if (B.has(w)) inter++;
  }
  return inter / Math.min(seen.size, B.size) >= 0.7;              // token containment
}

export default function EnrichmentBlock({
  enrichment,
  listingHasDescription,
  listingDescription,
  listingHasServices,
  listingHasServiceArea,
}: Props) {
  const k = enrichment.knowledge;

  // ALWAYS-ON (2026-09-15, dupurl-gate-and-flip-fan-v1). The enrichment description is a
  // DIFFERENT text from the listing's own -- a grounded summary of the business's own website --
  // so it is shown even when the listing carries its own description, UNLESS it merely restates
  // it (see restatesListing). The old gap-fill rule suppressed the description, and because the
  // presentation threshold below keys on it, that hid the ENTIRE block: certifications,
  // specialties, languages and year established went with it. 31,241 already-paid-for
  // enrichments rendered nothing because of this one line.
  //
  // services/service_areas stay GAP-FILLED: those genuinely duplicate what the listing shows.
  const enrichDescription = k.description ?? null;
  const description =
    enrichDescription && !(listingHasDescription && restatesListing(enrichDescription, listingDescription))
      ? enrichDescription
      : null;
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
