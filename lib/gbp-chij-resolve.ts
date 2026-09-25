/**
 * gbp-chij-resolve — paste-time ChIJ upgrade for owner-pasted Google links.
 * Mission: gbp-connect-chij-resolve-v1 · TDL #1256 · authorized by Terry 2026-09-22.
 *
 * WHY THIS EXISTS
 * Google's Share → Copy-link NEVER carries a ChIJ place id. Every owner paste
 * resolves to a feature-id (`0x…:0x…`), which the connector accepts and writes to
 * google_place_id. The listing then reads as CONNECTED — but every reviews path in
 * the estate gates on `isChIJPlaceId()` before the billed Places Details call, so a
 * feature-id row is connected-but-review-inert, forever, silently. The review deep
 * link (`writereview?placeid=`) is equally dead.
 *
 * WHAT THIS DOES
 * When — and only when — the resolver lands on a feature-id, perform ONE
 * owner-triggered Places Text Search (New) against the anchor carried by the
 * redirect landing URL, and accept the candidate's ChIJ ONLY on a verified match.
 *
 * THE MATCH TEST (and why it is not the spec's literal "street-level address")
 * The landing URL carries the business NAME and the place's own coordinate
 * (`!8m2!3d<lat>!4d<lng>`) — it does NOT carry a formatted street address, so there
 * is no address to compare against. The implementable test that serves the same
 * intent, and is strictly tighter than the legacy name+city heuristic that produced
 * the SWSM → "SWAT Health Junction" mislink, is:
 *
 *     distinctive name-token overlap  AND  candidate within MATCH_RADIUS_M of the
 *     landing's own coordinate.
 *
 * A wrong business is both name-mismatched AND hundreds of metres away; two genuine
 * tenants of one address are still separated by name. When in doubt we REFUSE.
 *
 * POLICY
 * Authorized per-listing owner-triggered class (empire-policy/zero_google_places.py
 * workflow_class="per_listing_refresh"). This NEVER seeds a row: it only refines an
 * identifier on a row the owner has already claimed and already connected. It runs
 * only inside the owner-cookie-gated gbp-connect POST — never on render, never in a
 * cron, never on an unclaimed row.
 *
 * ON REFUSAL the feature-id is KEPT. The listing stays connected. We never
 * downgrade to NULL, and we never write an unverified ChIJ.
 */

import type { GbpAnchor } from "./gbp-connector";

export const AUTHORIZATION_REF = "gbp-connect-chij-resolve-v1 (Terry 2026-09-22)";
export const MATCH_RADIUS_M = 75;
export const DAILY_CALL_CAP = 200;
const TEXTSEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
// googleMapsUri carries the place's CID; pureServiceAreaBusiness is audit context. Both sit in the
// same Text Search Pro SKU as location/formattedAddress — no price change per call.
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.pureServiceAreaBusiness";
const MAX_CANDIDATES = 5;

/** Places Details v1 and every reviews path accept ONLY a canonical ChIJ id. */
export const isChIJPlaceId = (id: unknown): boolean =>
  typeof id === "string" && /^ChIJ/i.test(id);

/** A Google share link's feature-id / CID-hex pair — connected, but review-inert. */
export const isFeatureId = (id: unknown): boolean =>
  typeof id === "string" && /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(id);

/**
 * The CID (decimal) carried by a feature-id's second half. `0x…:0x7563…` → "8458…".
 * gbp-resolve-name-mismatch-v1: this is the IDENTITY key. A Text Search candidate whose
 * googleMapsUri carries `cid=<this>` IS the place the owner shared — no name or distance
 * judgement needed. Returns null for `0x0` or anything unparseable.
 */
export function cidOfFeatureId(featureId: string): string | null {
  const hex = featureId.match(/^0x[0-9a-f]+:(0x[0-9a-f]+)$/i)?.[1];
  if (!hex) return null;
  try {
    const cid = BigInt(hex);
    return cid > BigInt(0) ? cid.toString() : null;
  } catch {
    return null;
  }
}

/** The `cid=` parameter of a Places googleMapsUri, or null. */
export function cidOfMapsUri(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  return uri.match(/[?&]cid=(\d+)/)?.[1] ?? null;
}

const NAME_STOPWORDS = new Set([
  "the", "and", "inc", "ltd", "llc", "corp", "company", "services", "service",
  "group", "solutions", "limited", "co", "of", "for", "your", "our",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Does the candidate share a distinctive token with the landing name? Tokens
 * shorter than 4 chars and generic corporate words are not distinctive, so they
 * cannot carry a match on their own.
 */
export function nameTokenOverlap(anchorName: string, candidateName: string): boolean {
  const tokens = normalize(anchorName)
    .split(" ")
    .filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t));
  const cand = normalize(candidateName);
  return tokens.length > 0 && tokens.some((t) => cand.includes(t));
}

export type ChijOutcome =
  | "chij_written"
  | "refused_unresolved"
  | "refused_no_anchor"
  | "refused_collision"
  | "refused_rate_limited"
  | "refused_unconfigured"
  | "error_places";

export type ChijUpgrade = {
  /** The id the caller must persist — the verified ChIJ, or the untouched feature-id. */
  placeId: string;
  outcome: ChijOutcome;
  /** Audit-safe reason string. Never contains review text. */
  detail: string;
  placesCalled: boolean;
};

type MinimalSupabase = {
  from: (t: string) => any;
};

/**
 * ONE verified Text Search. Returns the candidate ChIJ only on a confident match.
 * Never throws — a failure here must never fail the owner's save.
 *
 * gbp-resolve-name-mismatch-v1 (2026-09-25): a SERVICE-AREA business (a Maps outline, no
 * street pin) is EXCLUDED from Text Search unless `includePureServiceAreaBusinesses` is set —
 * that, not a name mismatch, is why "SMARTWEBSITE MANAGEMENT" returned zero candidates.
 * Such a candidate also comes back with NO location, so the 75 m gate cannot run on it.
 * It is accepted instead on IDENTITY: its googleMapsUri `cid=` equals the CID inside the
 * owner's own feature-id — exact, and strictly tighter than name + distance.
 * Still ONE call: the extra candidates ride the same request.
 */
async function verifiedChijFor(
  anchor: GbpAnchor,
  featureId: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<{ chij: string | null; detail: string; called: boolean }> {
  const body: Record<string, unknown> = {
    textQuery: anchor.name,
    maxResultCount: MAX_CANDIDATES,
    includePureServiceAreaBusinesses: true,
    // Bias to the landing coordinate so the top candidate is the right place to
    // begin with. The ACCEPT decision below is still made on our own measurement.
    locationBias: {
      circle: { center: { latitude: anchor.lat, longitude: anchor.lng }, radius: 500 },
    },
  };
  let res: Response;
  try {
    res = await fetchImpl(TEXTSEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    return { chij: null, called: true, detail: `places_fetch_failed:${e instanceof Error ? e.name : "unknown"}` };
  }
  if (!res.ok) return { chij: null, called: true, detail: `places_http_${res.status}` };

  let data: {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
      googleMapsUri?: string;
      pureServiceAreaBusiness?: boolean;
    }>;
  };
  try {
    data = await res.json();
  } catch {
    return { chij: null, called: true, detail: "places_bad_json" };
  }

  const places = (data.places || []).filter((p) => p?.id);
  if (places.length === 0) return { chij: null, called: true, detail: "no_candidate" };

  // 1. Identity: the candidate IS the shared place. Name is still reported, never required —
  //    the CID is Google's own key for the exact place the owner shared.
  const cid = cidOfFeatureId(featureId);
  const exact = cid ? places.find((p) => cidOfMapsUri(p.googleMapsUri) === cid) : undefined;
  if (exact?.id) {
    if (!isChIJPlaceId(exact.id)) return { chij: null, called: true, detail: "candidate_not_chij" };
    const nameOk = nameTokenOverlap(anchor.name, exact.displayName?.text ?? "");
    return {
      chij: exact.id,
      called: true,
      detail: `matched cid=${cid} nameOk=${nameOk} sab=${exact.pureServiceAreaBusiness === true} precise=${anchor.precise}`,
    };
  }

  // 2. Fallback — the pre-existing gate, unchanged in substance: the top candidate that HAS a
  //    location (i.e. the top physical place, what maxResultCount=1 returned before service-area
  //    businesses were included) must pass name-token overlap AND sit within MATCH_RADIUS_M.
  const c = places.find((p) => typeof p.location?.latitude === "number" && typeof p.location?.longitude === "number");
  if (!c?.id) return { chij: null, called: true, detail: `candidate_no_location n=${places.length} cid_match=false` };
  if (!isChIJPlaceId(c.id)) return { chij: null, called: true, detail: "candidate_not_chij" };

  const nameOk = nameTokenOverlap(anchor.name, c.displayName?.text ?? "");
  const lat = c.location!.latitude as number;
  const lng = c.location!.longitude as number;
  const metres = Math.round(haversineMeters(anchor.lat, anchor.lng, lat, lng));
  const coordOk = metres <= MATCH_RADIUS_M;

  if (!nameOk || !coordOk) {
    return {
      chij: null,
      called: true,
      detail: `refused nameOk=${nameOk} distance_m=${metres} limit=${MATCH_RADIUS_M} precise=${anchor.precise} cid_match=false`,
    };
  }
  return { chij: c.id, called: true, detail: `matched distance_m=${metres} precise=${anchor.precise}` };
}

/**
 * Upgrade a feature-id to a verified ChIJ, or leave it exactly as it was.
 * The caller persists `result.placeId` — which is the ORIGINAL id on every
 * refusal path, so a refusal is a no-op, never a downgrade.
 */
export async function upgradeFeatureIdToChij(opts: {
  placeId: string;
  anchor: GbpAnchor | null;
  listingId: string;
  listingSlug: string;
  listingsTable: string;
  supabase: MinimalSupabase;
  placeIdColumn?: string;
  vertical?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<ChijUpgrade> {
  const {
    placeId, anchor, listingId, listingSlug, listingsTable, supabase,
    placeIdColumn = "google_place_id",
    vertical = listingsTable.replace(/_listings$/, ""),
    apiKey = process.env.GOOGLE_PLACES_API_KEY,
    fetchImpl = fetch,
  } = opts;

  const keep = (outcome: ChijOutcome, detail: string, placesCalled = false): ChijUpgrade =>
    ({ placeId, outcome, detail, placesCalled });

  const audit = async (r: ChijUpgrade, writtenId: string) => {
    await supabase
      .from("empire_places_refresh_log")
      .insert({
        vertical,
        listing_table: listingsTable,
        listing_id: listingId,
        listing_slug: listingSlug,
        place_id: writtenId,
        outcome: r.outcome,
        caller: "owner",
        authorization_ref: AUTHORIZATION_REF,
        places_called: r.placesCalled,
        detail: r.detail.slice(0, 500),
      })
      .then(() => {}, () => {});
  };

  const done = async (r: ChijUpgrade) => { await audit(r, r.placeId); return r; };

  // Only a feature-id is eligible. A ChIJ is already review-capable; anything else
  // is not ours to touch. NO Places call on either path.
  if (!isFeatureId(placeId)) {
    return { placeId, outcome: "chij_written", detail: "not_a_feature_id:no_call", placesCalled: false };
  }
  if (!anchor) return done(keep("refused_no_anchor", "landing carried no name+coordinate anchor"));
  if (!apiKey) return done(keep("refused_unconfigured", "GOOGLE_PLACES_API_KEY absent"));

  // Cost tripwire. The audit table IS the meter: count today's billed calls under
  // this authorization ref. Fail CLOSED — a cap we cannot read is a cap we respect.
  try {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from("empire_places_refresh_log")
      .select("id", { count: "exact", head: true })
      .eq("authorization_ref", AUTHORIZATION_REF)
      .eq("places_called", true)
      .gte("called_at", since.toISOString());
    if (error) return done(keep("refused_rate_limited", `cap_unreadable:${error.code ?? "err"}`));
    if ((count ?? 0) >= DAILY_CALL_CAP) {
      console.error(
        `[gbp-chij-resolve] DAILY_CAP_BREACH ${count}/${DAILY_CALL_CAP} — refusing further Places calls today`,
      );
      return done(keep("refused_rate_limited", `DAILY_CAP_BREACH ${count}/${DAILY_CALL_CAP}`));
    }
  } catch (e) {
    return done(keep("refused_rate_limited", `cap_check_threw:${e instanceof Error ? e.name : "unknown"}`));
  }

  const { chij, detail, called } = await verifiedChijFor(anchor, placeId, apiKey, fetchImpl);
  if (!chij) {
    const r: ChijUpgrade = {
      placeId, outcome: called ? "refused_unresolved" : "error_places", detail, placesCalled: called,
    };
    await audit(r, placeId);
    return r;
  }

  // Collision: the ChIJ must not already sit on another listing. Refuse and keep
  // the feature-id — never pick a winner, never merge, never expose the other row.
  try {
    const { data: clash } = await supabase
      .from(listingsTable)
      .select("id")
      .eq(placeIdColumn, chij)
      .neq("id", listingId)
      .maybeSingle();
    if (clash?.id) {
      const r: ChijUpgrade = {
        placeId, outcome: "refused_collision",
        detail: `chij already linked to another listing in ${listingsTable}`,
        placesCalled: called,
      };
      await audit(r, placeId);
      return r;
    }
  } catch (e) {
    const r: ChijUpgrade = {
      placeId, outcome: "refused_collision",
      detail: `collision_check_failed:${e instanceof Error ? e.name : "unknown"}`,
      placesCalled: called,
    };
    await audit(r, placeId);
    return r;
  }

  const ok: ChijUpgrade = {
    placeId: chij, outcome: "chij_written",
    detail: `${detail} provenance=owner_supplied resolution=text_search_verified`,
    placesCalled: called,
  };
  await audit(ok, chij);
  return ok;
}

export const __testables__ = { normalize, nameTokenOverlap, haversineMeters, isFeatureId, isChIJPlaceId, cidOfFeatureId, cidOfMapsUri };
