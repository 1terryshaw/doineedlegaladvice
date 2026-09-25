// Owner location edits — claimant-edit-ux-stamp-v1 (Terry rulings R2 + R3, 2026-09-25).
//
// The owner update route calls planOwnerLocationEdit() AFTER it has built safeUpdates and
// BEFORE it writes. This module owns every location rule so the route stays a thin caller:
//
//   Street + postal (R2) — accepted ONLY when the row's source class is SELF_SERVE,
//     BUSINESS_SEEDED or MIXED (public.owner_address_edit_class, migration 040). PERSON_SEEDED,
//     register-family, no-source and unmapped rows are refused with "Contact us to change
//     your address." Postal must be a valid CA FSA / US ZIP whose prefix lies inside the
//     listing's province/state (the NEW one when it changes in the same save). String check
//     only — no geocoder, no Places call.
//   City + province (R3) — stay owner-editable exactly where they are today. On a change:
//     province is validated against the row's country; city_slug + region_slug are
//     re-derived with THIS repo's own intake convention (REGION_SLUG_MODE, measured from
//     app/api/list-your-business at stamp time); the listing slug and URL never change.
//   Every changed field is written to owner_edit_log (before/after) BEFORE the listing
//   UPDATE — no log row, no write. Any location change sets geo_stale, which withholds the
//   rooftop coordinate until someone re-geocodes (out of scope here).
//   After a successful write the listing page and the OLD and NEW city hubs are revalidated.
import { createHash } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
// Same version-agnostic shape as this repo's /api/admin/revalidate: Next 16 requires a profile
// argument ({ expire: 0 } = expire now); Next 15 ignores it.
const purgeTag = revalidateTag as unknown as (tag: string, profile?: { expire: number }) => void;
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { BUCKET } from "@/lib/owner-form-bucket";

// ── Per-repo stamp constant (PREFLIGHT §5, from this repo's own intake) ──────────────
//   "city"   — region_slug holds the CITY key (intake writes region_slug: city_slug)
//   "region" — region_slug holds the lower-cased province/state (state grain)
//   "none"   — the table has no region_slug column; city_slug is the only city key
export const REGION_SLUG_MODE: "city" | "region" | "none" = "city";
// true only where the public detail page reads through the ANON client with an explicit column
// list (anon holds no SELECT on geo_stale by design): the edit then also NULLs geo_precision_m,
// which that page's own precision gate already honours. The before-value is in owner_edit_log.
export const GEO_STALE_NULLS_PRECISION: boolean = false;
// false where the table has no show_address column (no hide toggle): an editable street there
// would publish unconditionally, so street/postal stay read-only ("Contact us").
export const STREET_EDIT_ENABLED: boolean = true;
// Set where the table keeps province in BOTH province and province_state as a measured 100%
// mirror and some read path keys on the other column: a change is written to both.
export const PROVINCE_MIRROR_COLUMN: string | null = null;

export const ADDRESS_EDIT_CLASSES = ["SELF_SERVE", "BUSINESS_SEEDED", "MIXED"] as const;
export const ADDRESS_LOCKED_MESSAGE = "Contact us to change your address.";

const CA_CODES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const US_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "PR",
];
const UK_CODES = ["ENG", "SCT", "WLS", "NIR"];
const COUNTRY_REGIONS: Record<string, string[]> = { CA: CA_CODES, US: US_CODES, GB: UK_CODES, UK: UK_CODES };
const COUNTRY_NAMES: Record<string, string> = { CA: "Canada", US: "the United States", GB: "the United Kingdom", UK: "the United Kingdom" };

// Canada Post FSA first letter -> province(s).
const FSA: Record<string, string[]> = {
  A: ["NL"], B: ["NS"], C: ["PE"], E: ["NB"], G: ["QC"], H: ["QC"], J: ["QC"],
  K: ["ON"], L: ["ON"], M: ["ON"], N: ["ON"], P: ["ON"], R: ["MB"], S: ["SK"], T: ["AB"],
  V: ["BC"], X: ["NT", "NU"], Y: ["YT"],
};
// USPS 3-digit ZIP prefix ranges -> state. A prefix not listed here is NOT refused
// (unknown ≠ wrong); only a prefix that belongs to a different state is.
const ZIP_RANGES: Array<[number, number, string]> = [
  [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"],
  [50, 54, "VT"], [55, 55, "MA"], [56, 59, "VT"], [60, 69, "CT"], [63, 63, "NY"], [70, 89, "NJ"],
  [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [201, 201, "VA"],
  [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
  [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"],
  [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"],
  [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [569, 569, "DC"], [570, 577, "SD"],
  [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"],
  [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [733, 733, "TX"],
  [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"], [900, 961, "CA"],
  [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];

export function slugifyCity(s: string): string {
  // Byte-identical to this repo's app/api/list-your-business slugify() (57/59 fleet intakes).
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function norm(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function statesForPostal(country: string, postal: string): string[] | null {
  if (country === "CA") return FSA[postal[0]] ?? null;
  if (country === "US") {
    const p = Number(postal.slice(0, 3));
    const hits = ZIP_RANGES.filter(([a, b]) => p >= a && p <= b).map(([, , s]) => s);
    return hits.length ? hits : null;
  }
  return null;
}

// Returns the canonical postal string, or an owner-facing error.
export function checkPostal(country: string, region: string, raw: string): { ok: true; value: string | null } | { ok: false; message: string } {
  const v = raw.trim().toUpperCase();
  if (!v) return { ok: true, value: null };
  let value: string;
  if (country === "CA") {
    const m = v.match(/^([A-Z]\d[A-Z])[ -]?(\d[A-Z]\d)$/);
    if (!m) return { ok: false, message: "Enter a Canadian postal code like A1A 1A1." };
    value = `${m[1]} ${m[2]}`;
  } else if (country === "US") {
    if (!/^\d{5}(-\d{4})?$/.test(v)) return { ok: false, message: "Enter a 5-digit ZIP code (or ZIP+4)." };
    value = v;
  } else {
    if (v.length > 12 || !/^[A-Z0-9 -]+$/.test(v)) return { ok: false, message: "Enter a valid postal code." };
    return { ok: true, value: v };
  }
  const states = statesForPostal(country, value);
  if (states && region && !states.includes(region.toUpperCase())) {
    return { ok: false, message: `That postal code isn't in ${region.toUpperCase()}. Contact us if your business has moved.` };
  }
  return { ok: true, value };
}

function checkStreet(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const v = raw.replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, message: "To hide your street address, untick \"Show my business address publicly\" instead of clearing it." };
  if (v.length < 5 || v.length > 120) return { ok: false, message: "Street address must be 5–120 characters." };
  if (/https?:|www\.|[<>{}]/i.test(v)) return { ok: false, message: "Street address can't contain links." };
  return { ok: true, value: v };
}

export async function addressEditClass(source: string | null | undefined): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("owner_address_edit_class", { p_source: source ?? null });
  if (error || typeof data !== "string") return "UNMAPPED"; // fail closed: refused
  return data;
}

export function addressEditAllowed(cls: string): boolean {
  return STREET_EDIT_ENABLED && (ADDRESS_EDIT_CLASSES as readonly string[]).includes(cls);
}

type Row = Record<string, unknown>;

function rowRegionMode(row: Row, oldCity: string, oldProv: string): "city" | "region" | null {
  const rs = norm(row.region_slug).toLowerCase();
  if (!rs) return null;
  if (rs === norm(row.province_state).toLowerCase() || rs === oldProv.toLowerCase()) return "region";
  if (rs === norm(row.city_slug).toLowerCase() || rs === slugifyCity(oldCity)) return "city";
  return null;
}
type LogRow = { table_name: string; listing_id: string; slug: string; field: string; before: string | null; after: string | null; actor: "owner"; owner_email_hash: string | null };

export type LocationPlan =
  | { ok: false; status: number; error: string; message: string }
  | { ok: true; log: LogRow[]; commit: () => Promise<{ ok: true } | { ok: false; message: string }>; afterWrite: () => void };

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/**
 * Mutates `safeUpdates` in place (adds derived slugs / geo_stale / canonical postal, or
 * removes nothing) and returns the audit rows + a post-write revalidation hook.
 * `body` is the raw request body (address/postal_code are read from it, never trusted as-is).
 */
export async function planOwnerLocationEdit(listingId: string, body: Row, safeUpdates: Row): Promise<LocationPlan> {
  const provCol = BUCKET.provinceColumn;
  const cols = ["id", "slug", "source", "country", "city", "city_slug", "address", "postal_code", "owner_email", "province_state", provCol];
  if (REGION_SLUG_MODE !== "none") cols.push("region_slug");
  if (GEO_STALE_NULLS_PRECISION) cols.push("geo_precision_m");
  if (PROVINCE_MIRROR_COLUMN) cols.push(PROVINCE_MIRROR_COLUMN);
  const { data: cur, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select(Array.from(new Set(cols)).join(", "))
    .eq("id", listingId)
    .single();
  if (error || !cur) return { ok: false, status: 500, error: "Failed to update", message: "We could not load your listing. Please try again." };
  const row = cur as unknown as Row;

  const country = norm(row.country).toUpperCase();
  const log: LogRow[] = [];
  const emailHash = typeof row.owner_email === "string" && row.owner_email
    ? createHash("sha256").update(row.owner_email.trim().toLowerCase()).digest("hex")
    : null;
  const push = (field: string, before: unknown, after: unknown) =>
    log.push({ table_name: LISTINGS_TABLE, listing_id: String(row.id), slug: String(row.slug), field, before: s(before), after: s(after), actor: "owner", owner_email_hash: emailHash });

  // ── City + province (R3) ──────────────────────────────────────────────────────────
  const oldCity = norm(row.city);
  const oldProv = norm(row[provCol]);
  let newCity = oldCity;
  let newProv = oldProv;
  if (typeof safeUpdates.city === "string") {
    const c = norm(safeUpdates.city);
    if (c !== oldCity) {
      if (!c) return { ok: false, status: 400, error: "invalid_city", message: "City can't be empty." };
      if (c.length > 80 || /https?:|www\.|[<>{}]/i.test(c) || !slugifyCity(c)) {
        return { ok: false, status: 400, error: "invalid_city", message: "Enter a valid city name." };
      }
      newCity = c;
      safeUpdates.city = newCity;
    } else {
      safeUpdates.city = row.city; // unchanged: keep the stored spelling byte-for-byte
    }
  }
  if (typeof safeUpdates[provCol] === "string") {
    const p = (safeUpdates[provCol] as string).trim().toUpperCase();
    if (p !== oldProv.toUpperCase()) {
      const allowed = COUNTRY_REGIONS[country];
      if (!allowed || !allowed.includes(p)) {
        return {
          ok: false, status: 400, error: "invalid_province",
          message: allowed
            ? `That province/state isn't in ${COUNTRY_NAMES[country] ?? country}. Contact us if your business has moved country.`
            : "Province/state can't be changed on this listing. Contact us.",
        };
      }
      newProv = p;
      safeUpdates[provCol] = p;
      if (PROVINCE_MIRROR_COLUMN) safeUpdates[PROVINCE_MIRROR_COLUMN] = p;
    } else {
      safeUpdates[provCol] = row[provCol]; // unchanged: keep the stored spelling byte-for-byte
    }
  }
  const cityChanged = newCity !== oldCity;
  const provChanged = newProv !== oldProv;
  let newCitySlug: string | null = null;
  let newRegionSlug: string | null = null;
  if (cityChanged || provChanged) {
    newCitySlug = slugifyCity(newCity);
    safeUpdates.city_slug = newCitySlug;
    // The ROW's own convention wins: several tables mix both (e.g. plumber: CITY_KEY intake,
    // 70% region-key rows whose province pages read region_slug = 'bc'). Re-keying a region-key
    // row to a city key would drop it from its province page. The repo's intake convention
    // (REGION_SLUG_MODE) decides only for a row that matches neither.
    const mode = REGION_SLUG_MODE === "none" ? "none" : (rowRegionMode(row, oldCity, oldProv) ?? REGION_SLUG_MODE);
    if (mode === "city") newRegionSlug = newCitySlug;
    if (mode === "region") newRegionSlug = newProv.toLowerCase();
    if (newRegionSlug !== null) safeUpdates.region_slug = newRegionSlug;
    if (cityChanged) push("city", row.city, newCity);
    if (provChanged) push(provCol, row[provCol], newProv);
    if (provChanged && PROVINCE_MIRROR_COLUMN) push(PROVINCE_MIRROR_COLUMN, row[PROVINCE_MIRROR_COLUMN], newProv);
    if (newCitySlug !== row.city_slug) push("city_slug", row.city_slug, newCitySlug);
    if (newRegionSlug !== null && newRegionSlug !== row.region_slug) push("region_slug", row.region_slug, newRegionSlug);
  }

  // ── Street + postal (R2) ──────────────────────────────────────────────────────────
  const wantsStreet = typeof body.address === "string" && norm(body.address) !== norm(row.address);
  const oldPostal = norm(row.postal_code).toUpperCase();
  const wantsPostal = typeof body.postal_code === "string" && norm(body.postal_code).toUpperCase().replace(/-/g, " ") !== oldPostal.replace(/-/g, " ");
  let streetOrPostalChanged = false;
  if (wantsStreet || wantsPostal || (provChanged && oldPostal)) {
    const cls = await addressEditClass(row.source as string | null);
    const allowed = addressEditAllowed(cls);
    if ((wantsStreet || wantsPostal) && !allowed) {
      return { ok: false, status: 403, error: "address_locked", message: ADDRESS_LOCKED_MESSAGE };
    }
    if (wantsStreet) {
      const r = checkStreet(body.address as string);
      if (!r.ok) return { ok: false, status: 400, error: "invalid_address", message: r.message };
      if (r.value !== norm(row.address)) {
        safeUpdates.address = r.value;
        push("address", row.address, r.value);
        streetOrPostalChanged = true;
      }
    }
    // Validate the postal the row will END with against the region it will END in — a
    // province change with a stored postal from the old province is refused too (address-
    // editable rows only; R3 never narrows city/province for refused classes).
    const finalPostalRaw = wantsPostal ? (body.postal_code as string) : oldPostal;
    if (allowed && (wantsPostal || provChanged) && finalPostalRaw) {
      const r = checkPostal(country, newProv, finalPostalRaw);
      if (!r.ok) return { ok: false, status: 400, error: "invalid_postal_code", message: r.message };
      if (wantsPostal && (r.value ?? "") !== oldPostal) {
        safeUpdates.postal_code = r.value;
        push("postal_code", row.postal_code, r.value);
        streetOrPostalChanged = true;
      }
    } else if (allowed && wantsPostal && !finalPostalRaw && oldPostal) {
      safeUpdates.postal_code = null;
      push("postal_code", row.postal_code, null);
      streetOrPostalChanged = true;
    }
  }

  if (cityChanged || provChanged || streetOrPostalChanged) {
    safeUpdates.geo_stale = true;
    push("geo_stale", null, "true");
    if (GEO_STALE_NULLS_PRECISION && row.geo_precision_m != null) {
      safeUpdates.geo_precision_m = null;
      push("geo_precision_m", row.geo_precision_m, null);
    }
  }

  const commit = async () => {
    if (log.length === 0) return { ok: true as const };
    const { error: logError } = await supabaseAdmin.from("owner_edit_log").insert(log);
    if (logError) {
      console.error("[owner/update] owner_edit_log insert failed", logError.code);
      return { ok: false as const, message: "We could not record this change, so nothing was saved. Please try again." };
    }
    return { ok: true as const };
  };

  const afterWrite = () => {
    const slug = String(row.slug);
    const hubs = new Set<string>();
    const hub = (prov: unknown, seg: unknown) => {
      const p = norm(prov), c = norm(seg);
      if (!p || !c) return;
      hubs.add(`/${p.toLowerCase()}/${c}`);
      hubs.add(`/${p}/${c}`);
    };
    const oldHubProv = row.province_state ?? oldProv;
    if (cityChanged || provChanged) {
      hub(oldHubProv, row.city_slug);
      if (REGION_SLUG_MODE !== "none") hub(oldHubProv, row.region_slug);
      hub(newProv, newCitySlug);
      if (newRegionSlug) hub(newProv, newRegionSlug);
    }
    try {
      purgeTag(`listing:${slug}`, { expire: 0 });
      revalidatePath(`/directory/${slug}`);
      revalidatePath(`/owner/${slug}`);
      hubs.forEach((h) => revalidatePath(h));
    } catch (e) {
      console.error("[owner/update] revalidate failed", e instanceof Error ? e.name : "unknown");
    }
  };

  return { ok: true, log, commit, afterWrite };
}
