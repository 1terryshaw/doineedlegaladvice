// ============================================================================
// data-sources.ts — THIS REPO'S OWN SOURCE MANIFEST, for /data-credits.
//
// Reads `data-sources.json` at the repo root. That file lists the `source` tags
// THIS directory actually serves — not the fleet's. The distinction matters: a
// credits page driven by a fleet-wide payload credits authorities whose rows this
// site has never held, which is a false provenance claim, not a generous one.
//
// The manifest is materialised offline from the canonical research
// (empire-legal-audit/{authority_map.py,verdicts.json}) and checked in, because the
// Vercel build cannot reach those files.
//
// FAIL-LOUD: `scripts/verify-data-sources.mjs` runs as `prebuild`. A source with no
// researched licence ("UNRESEARCHED"), no authority ("UNMAPPED"), or a required
// attribution with no verbatim line, FAILS THE BUILD. Nothing here guesses a credit.
// ============================================================================
import MANIFEST from "../data-sources.json";

export const DATA_SOURCES_SCHEMA_VERSION = "1.2.0";

export type DataSource = {
  /** The `source` column value on the rows this entry covers. */
  source_tag: string;
  /** Authority label from empire-legal-audit/authority_map.py. */
  authority: string;
  /** The dataset as the authority names it. */
  dataset: string;
  /**
   * RESEARCHED = the licence page was read and quoted.
   * NONE_ASSERTED = provenance is irrecoverable, so no licence is asserted over the rows.
   * There is no third value; the build gate refuses a blank.
   */
  contract_status: "RESEARCHED" | "NONE_ASSERTED";
  /** Licence name, e.g. "Open Database License (ODbL) 1.0". */
  licence: string;
  licence_url: string | null;
  /** true => crediting is a LICENCE CONDITION, not a courtesy. */
  attribution_required: boolean;
  /** The credit line the licence REQUIRES, verbatim. null when none is required. */
  attribution_line: string | null;
  /** The page the licence text was read from. */
  source_url: string | null;
  /** ISO date of the most recent load from this source. */
  last_seeded: string | null;
  /** HIGH = licence text located and quoted. LOW = inferred / not found. */
  confidence: "HIGH" | "LOW";
  /** false => the rows are held back, so the source is listed but not credited as served. */
  publishable?: boolean;
  note?: string;
  /** For NONE_ASSERTED: the work that closes the gap. */
  review_owed?: string;
  /**
   * A plain, non-licence source credit for rows whose provenance is IRRECOVERABLE.
   * Valid ONLY on a NONE_ASSERTED entry, and deliberately NOT the same field as
   * `credit_line`: that one means "a licence page exists and we were blocked from
   * reading it, so the verbatim line is still owed". This one means the opposite —
   * there is no page to read and no verbatim line will ever arrive, because the
   * originating authority was never recorded. It asserts NO licence and claims NO
   * permission; it exists so the credits page says something true about these rows
   * instead of leaving them uncredited.
   */
  plain_credit?: string;
  /**
   * A PRECAUTIONARY plain source credit, emitted when the licence text could not be read
   * and quoted — a clean NOT FOUND, or an HTTP 403/404/socket CHANNEL BLOCK. It never
   * claims the licence requires it. A blocked read is not proof that nothing is owed, and
   * it is not proof that something is either; crediting anyway is the safe direction.
   */
  credit_line?: string;
  /** true => the verbatim licence-required line is still owed. Always set with credit_line. */
  verbatim_pending?: boolean;
  /** An additional statement the recorded verdict says the source expects (e.g. non-endorsement). */
  extra_clause?: string;
  /** false => extra_clause is OUR wording, because the licensor's text could not be retrieved. */
  extra_clause_verbatim?: boolean;
};

type Manifest = {
  repo: string;
  table: string;
  sources: DataSource[];
};

const M = MANIFEST as unknown as Manifest;

/** Every source this repo declares, ordered by row-bearing authority name. */
export function allDataSources(): DataSource[] {
  return [...M.sources].sort((a, b) => a.authority.localeCompare(b.authority));
}

/** Only the sources whose rows are actually served. */
export function servedDataSources(): DataSource[] {
  return allDataSources().filter((s) => s.publishable !== false);
}

/**
 * Only the sources whose licence makes a credit mandatory, DEDUPED BY CREDIT LINE.
 *
 * One entry per `source` tag is right for the manifest — the per-source list below still shows
 * every tag, with its own dataset, licence and dates. It is wrong for the summary block at the
 * top of the page: a repo that seeded three OpenStreetMap extracts owes ONE "© OpenStreetMap
 * contributors", and printing it three times reads as a rendering bug on a legal surface, not as
 * three credits. The licence asks for the line, not for one line per file we downloaded.
 */
export function requiredAttributions(): DataSource[] {
  const seen = new Set<string>();
  return servedDataSources().filter((s) => {
    if (!s.attribution_required || !s.attribution_line) return false;
    const key = `${s.attribution_line}\u0000${s.licence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Sources whose provenance is irrecoverable and carry a plain, non-licence credit. */
export function plainCredits(): DataSource[] {
  return servedDataSources().filter((s) => s.plain_credit);
}

/** Sources carrying a precautionary credit because the licence text could not be read, deduped. */
export function precautionaryCredits(): DataSource[] {
  const seen = new Set<string>();
  return servedDataSources().filter((s) => {
    if (!s.credit_line || !s.verbatim_pending) return false;
    if (seen.has(s.credit_line)) return false;
    seen.add(s.credit_line);
    return true;
  });
}

/** The manifest entry for one `source` tag, or null when it is not declared. */
export function dataSourceFor(tag: string | null | undefined): DataSource | null {
  if (!tag) return null;
  return M.sources.find((s) => s.source_tag === tag) ?? null;
}

/**
 * The credit line owed for one row, or null when nothing is owed.
 * Never composes a credit — it returns only what the licence asked for, verbatim.
 */
export function creditLineFor(tag: string | null | undefined): string | null {
  const s = dataSourceFor(tag);
  if (!s) return null;
  if (s.attribution_required && s.attribution_line) return s.attribution_line;
  // Precautionary only — never presented as a licence condition.
  if (s.credit_line && s.verbatim_pending) return s.credit_line;
  return null;
}

export const dataSourcesRepo = M.repo;
export const dataSourcesTable = M.table;
