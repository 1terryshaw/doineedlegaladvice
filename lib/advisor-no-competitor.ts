// advisor-no-competitor v1 — STAMPED, byte-identical across the advisor fleet.
// Source of truth: ~/empire/advisor-no-competitor-v1/stamp/advisor-no-competitor.ts
//
// K35 ("chat safety belongs in code, not in the system prompt") applied to one
// commercial rule: the advisor must never send a user to a third-party
// marketplace. A prompt clause is a request; this module is the control.
//
// Two enforcement surfaces, both required:
//   1. NO_COMPETITOR_RULE  — appended to the system prompt (tone/compliance).
//   2. guardAdvisorResponse() — a POST-RESPONSE guard. On a denylist hit, or on
//      ANY off-fleet http(s) link, the model's text is DISCARDED and replaced
//      with the uncovered-vertical fallback. The hit is logged.
//
// K91 (parked domains): a cross-referral must only name a LIVE fleet host. Every
// nearest-trade link therefore resolves against the union front door
// (doineedapro.com/trade/<slug>, served by getapro-v2) — one host we know is live —
// never against a per-vertical spoke domain that may be parked and answering 200
// via a lander bounce.

/** Named third-party marketplaces / aggregators. Case-insensitive, word-anchored. */
export const COMPETITOR_RE =
  /\b(gigsalad|the ?bash|thumbtack|yelp|angi|angie'?s? list|bark\.com|homestars|houzz|porch\.com|taskrabbit|craigslist|kijiji|nextdoor|weddingwire|wedding wire|the ?knot|opentable|tripadvisor|trip advisor|yellow ?pages|pagesjaunes|yp\.ca|yp\.com|bbb\.org|better business bureau|trustpilot|manta\.com|foursquare|fiverr|upwork|rover\.com|wag!?|care\.com|zillow|realtor\.com|redfin|trulia|carfax|repairpal|openbay|zocdoc|healthgrades|vitals\.com|ratemds|avvo|legalzoom|rocket ?lawyer|lawyers?\.com|findlaw|nerdwallet|ratehub|indeed|linkedin|facebook marketplace|marketplace on facebook|instagram|tiktok|reddit|quora|google (?:maps|business|reviews|my business)|apple maps|bing places)\b/gi;

/** Hosts the advisor is allowed to name. Everything else is an off-fleet link. */
const FLEET_HOSTS: string[] = [
  "doineedapro.com", "getapro.org",
  "doineedaplumber.org", "doineedanelectrician.com", "doineedaroofer.com",
  "doineedapainter.com", "doineedalandscaper.com", "doineedacleaningservice.com",
  "doineedamovingcompany.com", "doineedahomeinspector.com", "doineedarealestateagent.org",
  "doineedhvac.com", "doineedageneralcontractor.com", "doineedaglazier.com",
  "doineedapestcontrol.com", "doineedamechanic.com", "doineedanautobodyshop.com",
  "doineedatireshop.com", "doineedadetailer.com", "doineedadrivinginstructor.com",
  "doineedadentist.org", "doineedatherapist.org", "doineedachiropractor.com",
  "doineedaphysiotherapist.com", "doineedamassagetherapist.com", "doineedanaturopath.com",
  "doineedanoptometrist.com", "doineedadermatologist.com", "doineedapersonaltrainer.com",
  "doineedacupuncture.com", "doineedaobgyn.com", "doineedaorthopedicsurgeon.com",
  "doineedapediatrician.com", "doineedaphysician.com", "doineedabarber.com",
  "doineedahairsalon.com", "doineedahairstylist.com", "doineedanailsalon.com",
  "doineedacosmetologist.com", "doineedesthetician.com",
  "doineedanaccountant.com", "doineedabookkeeper.com", "doineedafinancialadvisor.ca",
  "doineedafinancialadvisor.com", "doineedaninsurancebroker.com", "doineedanotary.com",
  "findmymortgagebroker.ca", "doineedanimmigrationconsultant.com",
  "doineedlegal.com", "doineedlegaladvice.com", "doineedlegalhelp.org", "freelawyeradvice.ca",
  "doineedavet.org", "doineedadogtrainer.com", "doineedapetgroomer.com", "doineedapetsitter.com",
  "doineedaweddingphotographer.com", "doineedacaterer.com", "doineedaflorist.com",
  "doineedaneventvenue.com", "doineedaphotographer.com",
  "doineedafishingguide.com", "doineedahuntingoutfitter.com",
  "idealskitrip.com", "bottomlesspowder.com", "shouldiheliski.com",
  "campgroundsforyou.com", "campgroundsnearme.ca", "canadaforyou.ca",
  "ontarioforyou.org", "unitedstatesforyou.com", "wavescure.com",
  "doineeditsupport.com", "doineedawebdesigner.com", "doineedatutor.com",
];

const LINK_RE = /https?:\/\/([a-z0-9.-]+)/gi;

// Public-authority / emergency hosts are NOT competitors. They are exempt from the
// off-fleet-link trigger so the guard can never swallow a crisis or regulator
// reference. (A NAMED marketplace still trips the guard regardless of host.)
const AUTHORITY_HOST_RE =
  /(?:^|\.)(?:gov|gc\.ca|gov\.uk|edu|ca\.gov|mil)$|(?:^|\.)(?:who\.int|211\.ca|911\.gov|988lifeline\.org|talksuicide\.ca|crisisservicescanada\.ca|kidshelpphone\.ca|poison\.org|cdc\.gov|nhs\.uk)$/i;

/** Union trade slugs, mirroring lib/consumer/union-routing.ts on getapro-v2. */
const TRADE_LABEL: Record<string, string> = {
  plumbing: "plumbers", electrical: "electricians", hvac: "HVAC pros",
  roofing: "roofers", painting: "painters", landscaping: "landscapers",
  cleaning: "cleaners", moving: "movers", homeinspector: "home inspectors",
  realestateagent: "real estate agents", "general-contractor": "general contractors",
  mechanic: "mechanics", autobodyshop: "auto body shops", tireshop: "tire shops",
  cardetailer: "car detailers", dentist: "dentists", therapist: "therapists",
  chiropractor: "chiropractors", physio: "physiotherapists",
  massagetherapist: "massage therapists", naturopath: "naturopaths",
  optometrist: "optometrists", dermatologist: "dermatologists",
  personaltrainer: "personal trainers", accountant: "accountants",
  bookkeeper: "bookkeepers", financialadvisor: "financial advisors",
  insurancebroker: "insurance brokers", notary: "notaries", lawyer: "lawyers",
  "mortgage-broker": "mortgage brokers", "immigration-consultant": "immigration consultants",
  vet: "vets", dogtrainer: "dog trainers", petgroomer: "pet groomers",
  petsitter: "pet sitters", weddingphotographer: "wedding photographers",
  caterer: "caterers", florist: "florists", eventvenue: "event venues",
  photographer: "photographers", fishingguide: "fishing guides",
  huntingoutfitter: "hunting outfitters", campground: "campgrounds",
  itsupport: "IT support", webdesigner: "web designers", tutor: "tutors",
};

/**
 * Uncovered need → up to 3 NEAREST COVERED trades, derived from the empire
 * cross-referral canon (the clusters the per-vertical `crossReferrals` blocks
 * already describe: events, home, auto, pet, professional).
 * There is deliberately NO general-contractor catch-all: an unmatched need
 * gets the union search link alone.
 */
// `search` is the term used in the union search link when the matched need is too
// short to be a usable query. VERIFIED 2026-09-10: doineedapro.com/directory?q= returns
// HTTP 500 for a query of 1-2 characters (a pre-existing union-search defect, reported
// separately) — "DJ" is exactly that case, so the fallback must never emit it.
const CLUSTERS: { id: string; re: RegExp; trades: string[]; search: string }[] = [
  {
    id: "events",
    search: "disc jockey",
    re: /\b(dj|d\.j\.|disc ?jockey|emcee|mc|master of ceremonies|band|live music|musician|entertainer|magician|photo ?booth|event planner|wedding planner|bartender|party rental|event rental|limo|limousine)\b/i,
    trades: ["eventvenue", "caterer", "photographer"],
  },
  {
    id: "access",
    search: "locksmith",
    re: /\b(locksmith|lock ?smith|re-?key|rekey|key cutting|locked out|deadbolt|alarm system|security (?:system|camera)s?|cctv|safe cracking)\b/i,
    trades: ["general-contractor", "electrical", "homeinspector"],
  },
  {
    id: "appliance",
    search: "appliance repair",
    re: /\b(appliance repair|appliance|washer|dryer|refrigerator|fridge|dishwasher|oven|stove|furnace repair)\b/i,
    trades: ["general-contractor", "electrical", "plumbing"],
  },
  {
    id: "openings",
    search: "window installer",
    re: /\b(window|windows|glazier|glass (?:repair|replacement)|garage door|door installer)\b/i,
    trades: ["general-contractor", "painting", "roofing"],
  },
  {
    id: "flooring",
    search: "flooring installer",
    re: /\b(floor|flooring|carpet|hardwood|laminate|tile setter|tiler)\b/i,
    trades: ["general-contractor", "painting", "cleaning"],
  },
  {
    id: "outdoor",
    search: "landscaping",
    re: /\b(pool|hot tub|deck builder|fence|fencing|patio|paving|driveway|snow removal|tree removal|arborist)\b/i,
    trades: ["landscaping", "general-contractor", "painting"],
  },
  {
    id: "haul",
    search: "junk removal",
    re: /\b(junk removal|hauling|dumpster|waste removal|estate sale|clean ?out)\b/i,
    trades: ["moving", "cleaning", "general-contractor"],
  },
  {
    id: "pest",
    search: "pest control",
    re: /\b(pest|exterminator|rodent|termite|bed ?bugs?|wasp|raccoon|wildlife removal)\b/i,
    trades: ["general-contractor", "cleaning", "landscaping"],
  },
];

export type AdvisorLinks = {
  /** "" on the union front door (same-site paths); an absolute origin on a spoke. */
  base: string;
};

/** The union front door. Every spoke points its fallback links here (K91). */
export const UNION_ORIGIN = "https://doineedapro.com";

function tradeHref(base: string, slug: string): string {
  return `${base}/trade/${slug}`;
}

// A query under 3 characters 500s on the union directory (verified 2026-09-10), so a
// too-short term is dropped rather than shipped as a link that breaks.
function unionSearchHref(base: string, need: string): string {
  const q = (need || "").trim();
  return q.length >= 3 ? `${base}/directory?q=${encodeURIComponent(q)}` : `${base}/directory`;
}

/** The term to search the union with: the cluster's canonical phrase if the matched need is too short. */
export function searchTermFor(userText: string, need: string): string {
  if (need && need !== "that" && need.length >= 3) return need;
  for (const c of CLUSTERS) if (c.re.test(userText || "")) return c.search;
  return "";
}

/** What the user asked for, as a display label. */
export function extractNeed(userText: string): string {
  const t = (userText || "").trim();
  for (const c of CLUSTERS) {
    const m = t.match(c.re);
    if (m) return m[0].length <= 3 ? m[0].toUpperCase() : m[0].toLowerCase();
  }
  const m = t.match(/\b(?:i need|i'm looking for|im looking for|looking for|find me|need)\s+(?:an?\s+|some\s+)?([a-z][a-z' -]{2,28}?)\b(?:\s+(?:in|near|for|to|that|who|around)\b|[.,!?]|$)/i);
  if (m) return m[1].trim().toLowerCase();
  return "that";
}

/** Up to 3 nearest covered trades for an uncovered need. May be empty. */
export function nearestCovered(userText: string): { slug: string; label: string }[] {
  const t = userText || "";
  for (const c of CLUSTERS) {
    if (c.re.test(t)) {
      return c.trades
        .filter((s) => TRADE_LABEL[s])
        .slice(0, 3)
        .map((s) => ({ slug: s, label: TRADE_LABEL[s] }));
    }
  }
  return [];
}

/** The uncovered-vertical fallback copy. Plain text, no bullets, <100 words. */
export function buildFallback(userText: string, links: AdvisorLinks): string {
  const need = extractNeed(userText);
  const article = need === "that" ? "" : /^[aeiou]/i.test(need) ? "an " : "a ";
  const search = unionSearchHref(links.base, searchTermFor(userText, need));
  const near = nearestCovered(userText);
  const head =
    need === "that"
      ? "We don't have a directory for that yet."
      : `We don't have ${article}${need} directory yet.`;
  const searchSentence = ` You can search everything we do cover at ${search}.`;
  if (!near.length) return head + searchSentence;
  const list = near
    .map((n, i) => `${i === near.length - 1 && near.length > 1 ? "and " : ""}${n.label} at ${tradeHref(links.base, n.slug)}`)
    .join(near.length > 2 ? ", " : " ");
  return `${head}${searchSentence} The closest we have are ${list}.`;
}

/** The prompt-side clause. Enforcement is guardAdvisorResponse(); this is tone. */
export const NO_COMPETITOR_RULE = `ABSOLUTE RULE — NO THIRD-PARTY MARKETPLACES. Never name, describe, recommend, or link to any outside directory, marketplace, review site, classifieds site or social network — including but not limited to GigSalad, The Bash, Thumbtack, Yelp, Angi, Bark, HomeStars, Houzz, TaskRabbit, Craigslist, Kijiji, Nextdoor, WeddingWire, The Knot, Zillow, Zocdoc, Avvo, Indeed, Google, Facebook and Instagram. Do not suggest the user "search online", "check reviews elsewhere" or "ask around on social media". The only places you may send anyone are pages on this site and other sites in this network.
IF WE DO NOT COVER WHAT THEY NEED: say plainly that we do not have that directory yet, give the network search link, and offer up to three of the closest directories we DO cover. Never invent a directory, and never fall back to "a general contractor" for something that is not a building trade.`;

function uniq(a: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < a.length; i++) if (out.indexOf(a[i]) === -1) out.push(a[i]);
  return out;
}

export type GuardResult = { message: string; hits: string[]; replaced: boolean };

/**
 * POST-RESPONSE GUARD. Returns the message to send. If the model named a
 * marketplace, or linked to any host outside the fleet, the whole reply is
 * discarded and replaced with the uncovered-vertical fallback.
 */
export function guardAdvisorResponse(
  message: string,
  userText: string,
  links: AdvisorLinks,
): GuardResult {
  const hits: string[] = [];
  const named = message.match(COMPETITOR_RE);
  if (named) uniq(named.map((s) => s.toLowerCase())).forEach((h) => hits.push(h));
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(message)) !== null) {
    const host = m[1].toLowerCase().replace(/^www\./, "");
    if (FLEET_HOSTS.indexOf(host) === -1 && !AUTHORITY_HOST_RE.test(host)) hits.push(`offfleet:${host}`);
  }
  if (!hits.length) return { message, hits, replaced: false };
  return { message: buildFallback(userText, links), hits: uniq(hits), replaced: true };
}

/**
 * Prompt-side: append the rule to whatever system prompt the route already built.
 */
export function withNoCompetitorRule(system: string): string {
  return `${system}\n\n${NO_COMPETITOR_RULE}`;
}

/**
 * Route-side convenience wrapper. `base` defaults to the union front door, which is
 * correct for every spoke; the union front door itself passes "" for same-site paths.
 */
export function noCompetitor(
  message: string,
  messages: { role: string; content: string }[] | unknown,
  base: string = UNION_ORIGIN,
): string {
  const arr = Array.isArray(messages) ? (messages as { role: string; content: string }[]) : [];
  let lastUser = "";
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] && arr[i].role === "user") { lastUser = String(arr[i].content || ""); break; }
  }
  const r = guardAdvisorResponse(String(message ?? ""), lastUser, { base });
  if (r.replaced) console.warn(`[no-competitor] replaced reply; hits=${r.hits.join(",")}`);
  return r.message;
}
