// Types, constants, validators, and server-side sanitisers for the canonical
// OwnerEditForm v1 (photos + 7 SEO fields). Kept separate from lib/supabase.ts
// (which is in the empire-wide DO NOT TOUCH list) — extension is via the
// `Listing & ListingExtras` intersection used by the edit page and form.

export type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export const DAY_KEYS: DayKey[] = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

export const SCHEMA_DAY: Record<DayKey, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

export interface DayHours {
  closed: boolean;
  open24: boolean;
  opens: string; // "HH:MM"
  closes: string; // "HH:MM"
}

export type HoursJson = Record<DayKey, DayHours>;

export const DEFAULT_DAY: DayHours = {
  closed: true,
  open24: false,
  opens: "09:00",
  closes: "17:00",
};

export function emptyHours(): HoursJson {
  return DAY_KEYS.reduce((acc, d) => {
    acc[d] = { ...DEFAULT_DAY };
    return acc;
  }, {} as HoursJson);
}

export function normalizeHours(input: unknown): HoursJson | null {
  if (!input || typeof input !== "object") return null;
  const src = input as Record<string, Partial<DayHours>>;
  const out = emptyHours();
  let any = false;
  for (const k of DAY_KEYS) {
    const d = src[k];
    if (d && typeof d === "object") {
      out[k] = {
        closed: !!d.closed,
        open24: !!d.open24,
        opens: typeof d.opens === "string" ? d.opens : "09:00",
        closes: typeof d.closes === "string" ? d.closes : "17:00",
      };
      any = true;
    }
  }
  return any ? out : null;
}

// Human-readable hours line for the directory page hours grid.
export function formatHoursLine(d: DayHours): string {
  if (d.closed) return "Closed";
  if (d.open24) return "Open 24 hours";
  return `${d.opens} – ${d.closes}`;
}

// schema.org openingHoursSpecification[]
export function buildOpeningHoursSpec(h: HoursJson) {
  const specs: Array<Record<string, unknown>> = [];
  for (const k of DAY_KEYS) {
    const d = h[k];
    if (d.closed) continue;
    if (d.open24) {
      specs.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY[k],
        opens: "00:00",
        closes: "23:59",
      });
    } else {
      specs.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY[k],
        opens: d.opens,
        closes: d.closes,
      });
    }
  }
  return specs;
}

export interface ListingPhoto {
  id: string;
  public_url: string;
  display_order: number;
  photo_kind: "photo" | "logo";
}

export interface ListingExtras {
  hours_json?: HoursJson | null;
  services?: string[] | null;
  service_area?: string[] | null;
  gbp_url?: string | null;
  year_established?: number | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  social_linkedin?: string | null;
}

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_SERVICES = 20;
export const MAX_SERVICE_AREA = 10;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];

// === GBP URL validation ===========================================
//
// Single anchored regex (plumber commit 3009c23 baseline) extended with
// ccTLD support so Canadian/EU URLs (`maps.google.ca`, `google.co.uk/maps`)
// validate cleanly. Test cases live in
// canonical-owner-edit-form-v1/tests/gbp-regex-cases.json.
//
// PASS:
//   https://maps.app.goo.gl/<id>      (modern Share-button standard)
//   https://maps.google.<tld>/...     (any ccTLD)
//   https://(www.)?google.<tld>/maps/...
//   https://goo.gl/maps/...
//   https://g.page/<biz>              (incl. /r/<id>)
// FAIL:
//   https://business.google.com/...   (admin console — never the public URL)
//   https://maps.apple.com/...        (different vendor)
//   anything else
//
// The form uses this as a soft warning (does NOT block save) — see UrlInput.
export const GBP_PATTERN =
  /^(?:https?:\/\/)?(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+\/|maps\.app\.goo\.gl\/|goo\.gl\/maps|g\.page\/)/i;

export function isValidGbpUrl(url: string): boolean {
  if (!url) return true;
  return GBP_PATTERN.test(url);
}

export function isValidSocial(
  url: string,
  kind: "instagram" | "facebook" | "linkedin"
): boolean {
  if (!url) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.replace(/^www\./, "");
    if (kind === "instagram") return host === "instagram.com";
    if (kind === "facebook") {
      return host === "facebook.com" || host === "fb.com" || host === "m.facebook.com";
    }
    if (kind === "linkedin") return host === "linkedin.com";
    return false;
  } catch {
    return false;
  }
}

// Used by /api/owner/update — list the new fields the form may send.
export const EXTRA_UPDATE_FIELDS = [
  "hours_json",
  "services",
  "service_area",
  "gbp_url",
  "year_established",
  "social_instagram",
  "social_facebook",
  "social_linkedin",
] as const;

export type ExtraUpdateField = typeof EXTRA_UPDATE_FIELDS[number];

// Sanitise per-field on the server. Invalid URLs are nulled rather than
// stored verbatim — the soft-warn in the form tells the owner before they
// save, but a malformed URL that gets through is still cleaned up here.
export function sanitizeExtras(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("hours_json" in input) {
    out.hours_json = input.hours_json === null ? null : normalizeHours(input.hours_json);
  }
  if ("services" in input) {
    out.services = Array.isArray(input.services)
      ? (input.services as unknown[])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, MAX_SERVICES)
      : null;
  }
  if ("service_area" in input) {
    out.service_area = Array.isArray(input.service_area)
      ? (input.service_area as unknown[])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, MAX_SERVICE_AREA)
      : null;
  }
  if ("gbp_url" in input) {
    const v = typeof input.gbp_url === "string" ? input.gbp_url.trim() : "";
    out.gbp_url = v && isValidGbpUrl(v) ? v : (v ? null : "");
  }
  if ("year_established" in input) {
    const n = typeof input.year_established === "number"
      ? input.year_established
      : parseInt(String(input.year_established ?? ""), 10);
    const now = new Date().getFullYear();
    out.year_established = Number.isFinite(n) && n >= 1800 && n <= now ? n : null;
  }
  for (const k of ["social_instagram", "social_facebook", "social_linkedin"] as const) {
    if (k in input) {
      const v = typeof input[k] === "string" ? (input[k] as string).trim() : "";
      const kind = k.replace("social_", "") as "instagram" | "facebook" | "linkedin";
      out[k] = v && isValidSocial(v, kind) ? v : (v ? null : "");
    }
  }
  return out;
}
