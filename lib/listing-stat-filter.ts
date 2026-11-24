// proof-of-life telemetry integrity (beacon v2) — pure, dependency-free decision helpers shared by
// app/api/listing-stat/route.ts (server) and components/ListingStatsBeacon.tsx (client).
//
// What is excluded, and how — all without storing anything about the visitor (no IP, no hash, no UA, no id):
//   • automation   — UA bot/crawler/headless list (server) + navigator.webdriver (client: Playwright/Selenium/Puppeteer).
//   • cross-site   — a beacon not sent from the listing page itself (browser-set Sec-Fetch-Site ≠ same-origin).
//   • the owner    — the request carries the site's existing owner-session cookie for THIS listing (the cookie the
//                    owner dashboard already sets on login). The server answers `x-ls-owner: 1`, and the browser then
//                    remembers locally (localStorage, never sent anywhere) that it is the owner's device for this
//                    listing, so later visits after logout are not counted either.
//   • owner links  — a landing URL tagged ref=owner (owner emails) marks the device the same way.
//   • internal     — Empire staff/QA opt a browser out once with ?ls_internal=1 (undo with ?ls_internal=0).
//   • hidden pages — a view is only counted once the page is actually visible (prerender/background tabs never count).
// Pageviews remain "views" (one per listing per tab session) — never people, visitors or leads.

export const BOT_UA = /bot|crawler|spider|crawl|slurp|GPTBot|ClaudeBot|anthropic-ai|claude-web|PerplexityBot|Perplexity-User|CCBot|Bytespider|Google-Extended|GoogleOther|facebookexternalhit|Amazonbot|Applebot|headless|lighthouse|curl|wget|python-requests|node-fetch|axios|Go-http-client|okhttp|java\/|libwww|httpclient|scrapy|phantomjs|selenium|puppeteer|playwright/i;

export type ServerSignals = {
  ua: string | null;
  secFetchSite: string | null;
  ownerCookieSlug: string | null; // slug part of the site's existing `<prefix>owner_token` cookie, if any
  slug: string;
};

/** null ⇒ count it. Otherwise the reason it is not counted (never stored, only used for the response). */
export function serverSkipReason(s: ServerSignals): "bot" | "cross_site" | "owner" | null {
  if (!s.ua || BOT_UA.test(s.ua)) return "bot";
  // Browser-set and unforgeable from page JS. Deliberately NOT comparing Origin with Host: fleet-edge/Cloudflare
  // workers proxy /api/* to the Vercel origin, so Host can legitimately differ from the public Origin.
  if (s.secFetchSite && s.secFetchSite !== "same-origin") return "cross_site";
  if (s.ownerCookieSlug && s.ownerCookieSlug === s.slug) return "owner";
  return null;
}

export type ClientSignals = { webdriver: boolean; internal: boolean; ownerDevice: boolean };
export function clientSkipReason(c: ClientSignals): "automation" | "internal" | "owner_device" | null {
  if (c.webdriver) return "automation";
  if (c.internal) return "internal";
  if (c.ownerDevice) return "owner_device";
  return null;
}

export const LS_INTERNAL = "ls_internal";
export const ownerKey = (slug: string) => `ls_owner:${slug}`;

/** Landing-URL flags: ?ls_internal=1|0 (staff opt-out), ?ref=owner (link mailed to the listing's owner). */
export function urlFlags(search: string): { internal: "1" | "0" | null; ownerRef: boolean } {
  const p = new URLSearchParams(search);
  const i = p.get(LS_INTERNAL);
  return { internal: i === "1" ? "1" : i === "0" ? "0" : null, ownerRef: p.get("ref") === "owner" };
}
