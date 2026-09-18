import { LANE_ACCENT, LANE_NOTICE_BG, LANE_NOTICE_BORDER, lanePublicUrl } from "@/lib/lane-gate";

/**
 * THE LANE'S DISPLAY CONTRACT (spec §3).
 *
 * The contract is LOAD-BEARING: a lane row must be unreadable as a licensed-attorney
 * credential by a human skimming it, by a reader who lands cold, and by a machine parsing
 * the graph.
 *
 * ── WHY THIS RENDERS AN HTML STRING AND NOT JSX ─────────────────────────────────────
 * §3.1's assertion is a BYTE OFFSET — `indexOf('<!--lane-disclaimer-->') < indexOf('<h1')`,
 * with nothing between the start of the lane's output and the marker. A JSX tree cannot be
 * asserted that way without rendering it, and rendering it needs React DOM, a tsconfig with
 * `jsx`, and a harness that can no longer be a plain `.mts`. A pure string render is
 * assertable with no deploy, no database and no renderer
 * (`feedback_render_proof_needs_no_deploy`: the render is a pure function — assert the HTML,
 * not the model). The page component's whole job is to drop this string into `<main>`.
 *
 * Deliberately NOT `server-only`.
 */

export interface LaneListing {
  readonly business_name: string;
  readonly contact_name: string | null;
  readonly address_line: string | null;
  readonly city: string;
  readonly region_state: string;
  readonly postal_code: string | null;
  readonly country: string;
  readonly phone: string | null;
  readonly website: string | null;
  readonly public_email: string | null;
  readonly description: string | null;
  readonly slug: string;
}

/** The marker comments that BOUND the one region where the negated vocabulary may appear. */
export const DISCLAIMER_OPEN = "<!--lane-disclaimer-->";
export const DISCLAIMER_CLOSE = "<!--/lane-disclaimer-->";

/**
 * Markers bounding THE LANE'S OWN OUTPUT within the finished page.
 *
 * 🔴 THEY EXIST BECAUSE THE PAGE IS NOT ALL OURS. `app/layout.tsx` wraps every route in the
 * site's shared Header, Footer, Disclaimer and Organization JSON-LD, and those legitimately
 * carry `verticalConfig.primaryColor` and the word "lawyer" — they are the site's chrome, not
 * the lane's, and the lane neither owns nor may change them. An end-to-end assertion that
 * scanned the WHOLE document would be measuring the site and reporting it as a lane defect.
 * These markers give the probe a bounded region that is exactly what this module emitted.
 */
export const LANE_CONTENT_OPEN = "<!--lane-content-->";
export const LANE_CONTENT_CLOSE = "<!--/lane-content-->";

/**
 * THE DISCLAIMER — exact copy, exact position (§3.1).
 *
 * Rendered as the FIRST element inside `<main>`, BEFORE the `<h1>`. Never a footer, never
 * collapsed, never behind a toggle. `<main>` is `app/layout.tsx:33` and wraps `{children}`
 * directly, so "first node the lane page returns" IS "first element inside `<main>`".
 *
 * ⚠️ IT USES THREE OF THE BANNED WORDS, IN THE NEGATIVE. That is why the marker comments
 * exist: the token assertion scopes the ban to everything OUTSIDE this region. The hospice
 * lesson, inverted — the fix for a banned word is the COPY, never an exception carved into
 * the token list, and the marker gives one bounded, reviewable region where the negation
 * lives.
 */
export const DISCLAIMER_LEAD = "This is a self-submitted listing.";
export const DISCLAIMER_BODY =
  "The business below supplied this information itself. We have not verified it, and this " +
  "listing is not a licensed-attorney credential — it does not show a bar admission, a licence " +
  "number, or any check by a state bar. Confirm any lawyer's licence with the state bar before " +
  "relying on it.";

/**
 * THE BANNED VOCABULARY (§3.1), as a machine-checkable list.
 *
 * Every entry is a claim the lane cannot support. Matched case-insensitively against the
 * lane's rendered output with the disclaimer region EXCISED — see `bannedTokensOutsideDisclaimer`.
 */
export const BANNED_LANE_TOKENS: readonly string[] = [
  "attorney", "lawyer", "licensed", "bar admission", "bar number",
  "verified", "certified", "accredited",
];

/**
 * Keys the lane's JSON-LD forbids (§3.5), asserted on the EMITTED OBJECT GRAPH, not on the
 * source. A source check passes on a builder that computes the key name.
 */
export const BANNED_JSONLD_KEYS: readonly string[] = [
  "aggregateRating", "review", "ratingValue", "hasOfferCatalog", "makesOffer", "award",
  "identifier", "additionalType", "sourceOrganization", "provider", "isPartOf",
  "knowsAbout", "areaServed", "priceRange",
];

/** The only two `@type` values the lane's graph may carry. */
export const ALLOWED_JSONLD_TYPES: readonly string[] = ["LocalBusiness", "PostalAddress"];

export class LaneStructuredDataRefusal extends Error {
  readonly code = "LANE_STRUCTURED_DATA_PROHIBITED_KEY";
}

function assertLaneGraph(node: unknown, path = "$"): void {
  if (Array.isArray(node)) {
    node.forEach((c, i) => assertLaneGraph(c, `${path}[${i}]`));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (BANNED_JSONLD_KEYS.includes(key)) {
      throw new LaneStructuredDataRefusal(
        `LANE_STRUCTURED_DATA_PROHIBITED_KEY: "${key}" at ${path} — a self-submitted row has no ` +
          "rating, no offer catalogue, no identifier, is part of no dataset and was provided by " +
          "nobody we checked.",
      );
    }
    if (key === "@type" && typeof value === "string" && !ALLOWED_JSONLD_TYPES.includes(value)) {
      throw new LaneStructuredDataRefusal(
        `LANE_STRUCTURED_DATA_PROHIBITED_KEY: "@type":"${value}" at ${path} — the lane emits a bare ` +
          "LocalBusiness. LegalService is a LocalBusiness subtype that carries the " +
          "professional-services implicature this page exists to deny, and a BreadcrumbList would " +
          "place the page inside the directory's own hierarchy — the graph-level version of the " +
          "claim the disclaimer denies.",
      );
    }
    assertLaneGraph(value, `${path}.${key}`);
  }
}

/**
 * THE LANE'S JSON-LD (§3.5) — a bare `LocalBusiness`, and only this.
 *
 * NONE of `app/directory/[slug]/page.tsx`'s builder is reused: it emits `LegalService` with a
 * conditional `AggregateRating`, `hasOfferCatalog`/`Offer`, `areaServed`, `numberOfEmployees`,
 * `paymentAccepted`, `sameAs`, a separate `BreadcrumbList` and an `FAQPage`.
 *
 * Optional keys are emitted only when non-empty. An empty string is a CLAIM that the field is
 * blank, which is a different thing from not knowing it.
 */
export function laneStructuredData(row: LaneListing): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: row.business_name,
    address: {
      "@type": "PostalAddress",
      ...(row.address_line ? { streetAddress: row.address_line } : {}),
      addressLocality: row.city,
      addressRegion: row.region_state,
      ...(row.postal_code ? { postalCode: row.postal_code } : {}),
      addressCountry: row.country,
    },
    ...(row.phone ? { telephone: row.phone } : {}),
    url: lanePublicUrl(row.slug),
    ...(row.website ? { sameAs: undefined } : {}),
    ...(row.description ? { description: row.description } : {}),
  };
  // `JSON.stringify` KEEPS `null` and DROPS `undefined` — so the `sameAs: undefined` above
  // disappears entirely rather than emitting a null. Delete it anyway so the in-memory graph
  // the assertion walks is the same object the page serialises.
  delete node.sameAs;
  assertLaneGraph(node);
  return node;
}

// ── HTML ────────────────────────────────────────────────────────────────────────────
const esc = (v: string): string =>
  (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function laneTitle(row: LaneListing): string {
  return `${row.business_name} — self-submitted listing`;
}

export function laneMetaDescription(row: LaneListing): string {
  return (
    `Self-submitted listing for ${row.business_name} in ${row.city}, ${row.region_state}. ` +
    "Submitted by the business itself and not checked by us."
  );
}

/**
 * THE LANE PAGE BODY.
 *
 * Order is the contract: marker → disclaimer → marker-close → `<h1>`. Nothing before the
 * marker, and the `<h1>` after it.
 *
 * 🔴 NO `#0f4c75` AND NO `verticalConfig.primaryColor` ANYWHERE IN THIS OUTPUT (§3.6). Where
 * the prose and the design disagree about whether a page is a directory listing, the visitor
 * believes the design.
 */
/**
 * THE LANE PAGE, AS TWO INJECTION HOSTS.
 *
 * 🔴 THE SPLIT IS THE §3.1 CONTRACT, NOT A STYLE CHOICE.
 *
 * React cannot inject raw HTML without a HOST ELEMENT — `dangerouslySetInnerHTML` always
 * belongs to a tag. The first build put the whole body inside one `<div>`, so the live page
 * read `<main><div><!--lane-disclaimer-->…`, and that `<div>` is "another element between
 * <main> and the marker". The live E2E probe caught it; every unit test had passed, because a
 * unit test sees the string and never the page.
 *
 * So the DISCLAIMER IS ITS OWN HOST. The page renders `<aside>` first, with the marker as its
 * first child, which makes the disclaimer literally the first element inside `<main>` — the
 * only thing between them is the disclaimer's own opening tag. The detail follows in a second
 * host.
 *
 * `renderLaneBodyHtml` composes both hosts so the Layer-1 harness asserts the same bytes the
 * page produces; the page uses the two INNER functions with hosts carrying the same styles.
 */
export const LANE_DISCLAIMER_STYLE = {
  background: LANE_NOTICE_BG,
  borderLeft: `4px solid ${LANE_NOTICE_BORDER}`,
  padding: "16px 24px",
  margin: "0 0 24px",
} as const;

export const LANE_DETAIL_STYLE = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "8px 20px 64px",
} as const;

const styleAttr = (o: Record<string, string | number>): string =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${typeof v === "number" ? `${v}px` : v}`)
    .join(";");

/** The disclaimer host's INNER html. The marker is its first child. */
export function renderLaneDisclaimerHtml(): string {
  return (
    `${DISCLAIMER_OPEN}` +
    `<p style="margin:0;font-weight:700">${esc(DISCLAIMER_LEAD)}</p>` +
    `<p style="margin:8px 0 0">${esc(DISCLAIMER_BODY)}</p>` +
    `${DISCLAIMER_CLOSE}`
  );
}

/** The detail host's INNER html. Never contains a banned token — see the token assertion. */
export function renderLaneDetailHtml(row: LaneListing): string {
  const rows: string[] = [];
  const addr = [row.address_line, row.city, row.region_state, row.postal_code]
    .filter((v) => v && String(v).trim() !== "")
    .join(", ");
  if (addr) rows.push(`<div class="lane-field"><dt>Address</dt><dd>${esc(addr)}</dd></div>`);
  if (row.phone) {
    rows.push(
      `<div class="lane-field"><dt>Phone</dt><dd><a href="tel:${esc(row.phone)}" style="color:${LANE_ACCENT}">${esc(row.phone)}</a></dd></div>`,
    );
  }
  if (row.website) {
    rows.push(
      `<div class="lane-field"><dt>Website</dt><dd><a href="${esc(row.website)}" rel="nofollow noopener noreferrer" target="_blank" style="color:${LANE_ACCENT}">${esc(row.website)}</a></dd></div>`,
    );
  }
  if (row.public_email) {
    rows.push(
      `<div class="lane-field"><dt>Email</dt><dd><a href="mailto:${esc(row.public_email)}" style="color:${LANE_ACCENT}">${esc(row.public_email)}</a></dd></div>`,
    );
  }
  if (row.contact_name) {
    rows.push(`<div class="lane-field"><dt>Contact</dt><dd>${esc(row.contact_name)}</dd></div>`);
  }
  return (
    `${LANE_CONTENT_OPEN}` +
    `<h1 style="color:${LANE_ACCENT};font-size:28px;font-weight:700;margin:0 0 4px">${esc(row.business_name)}</h1>` +
    `<p style="margin:0 0 20px;color:#64748b">${esc(row.city)}, ${esc(row.region_state)}</p>` +
    (rows.length ? `<dl style="margin:0 0 24px">${rows.join("")}</dl>` : "") +
    (row.description ? `<div style="margin:0 0 24px;line-height:1.6">${esc(row.description)}</div>` : "") +
    `<p style="margin:0;font-size:13px;color:#64748b">Everything on this page was supplied by the submitter and confirmed only to the extent that they control the email address it was submitted from.</p>` +
    `${LANE_CONTENT_CLOSE}`
  );
}

/** The whole fragment, hosts included — the exact shape the page renders. */
export function renderLaneBodyHtml(row: LaneListing): string {
  return (
    `<aside role="note" aria-label="Self-submitted listing notice" style="${styleAttr(LANE_DISCLAIMER_STYLE)}">` +
    renderLaneDisclaimerHtml() +
    `</aside>` +
    `<div style="${styleAttr(LANE_DETAIL_STYLE)}">` +
    renderLaneDetailHtml(row) +
    `</div>`
  );
}

/**
 * The banned-token check, with the disclaimer region EXCISED by its markers.
 *
 * The region is cut, not exempted: a token list with a carved-out exception is a token list
 * that will acquire more of them. One bounded region, delimited in the output itself, is
 * reviewable; a growing exception list is not.
 */
export function bannedTokensOutsideDisclaimer(html: string): string[] {
  const start = html.indexOf(DISCLAIMER_OPEN);
  const end = html.indexOf(DISCLAIMER_CLOSE);
  const scanned =
    start >= 0 && end > start
      ? html.slice(0, start) + html.slice(end + DISCLAIMER_CLOSE.length)
      : html;
  const lower = scanned.toLowerCase();
  return BANNED_LANE_TOKENS.filter((t) => lower.includes(t.toLowerCase()));
}
