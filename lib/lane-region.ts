import { US_STATE_CODES } from "@/lib/region-scope";

/**
 * THE LANE'S REGION RESOLUTION (spec §5.1 step 4).
 *
 * 🔴 TWO TIERS, AND ONLY ONE OF THEM IS BINDING.
 *
 *   T1 — the STATE CODE. Binding. `US_STATE_CODES` (51, incl. DC) is DINLA's geography, and
 *        `lane-validate.ts` refuses anything outside it before this module is reached.
 *   T2 — the CITY. ADVISORY ONLY. `region_resolution` records KNOWN/UNKNOWN against the
 *        lane's own observed set and NEVER refuses. A legitimate firm in a town the
 *        directory has never covered must not be turned away because our coverage is thin —
 *        that would make the lane a mirror of the directory instead of a way into it.
 *
 * There is no `empire_known_places` wiring in this repo and none is added. Inventing one
 * would be a new authority surface for a field that decides nothing.
 */

export type RegionResolution = "KNOWN" | "UNKNOWN";

/** Counts prior lane rows in this (state, city). Injected; the store implements it. */
export type CityObserved = (regionState: string, city: string) => Promise<boolean>;

export function isServedRegion(code: string): boolean {
  return US_STATE_CODES.has((code ?? "").trim().toUpperCase());
}

/**
 * ADVISORY. A throw or a miss is `UNKNOWN`, never a refusal — the caller must not branch on
 * this value except to record it.
 */
export async function resolveRegion(
  regionState: string,
  city: string,
  observed: CityObserved,
): Promise<RegionResolution> {
  try {
    return (await observed(regionState, city)) ? "KNOWN" : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
