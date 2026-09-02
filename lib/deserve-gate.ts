// COMPLIANCE / SEO — 410 Gone gate for DE-SERVED listing rows.
// SHARED FILE: byte-identical across every de-served vertical. Do not fork.
//
// CANONICAL COPY: empire-policy/deserve_gate.ts (K101 — clone fixes return to the donor).
// Each repo carries a byte-identical copy at lib/deserve-gate.ts. Sync + drift check:
//   empire-policy/sync_deserve_gate.sh --write <repoDir>
//   empire-policy/sync_deserve_gate.sh --verify
// Edit the canonical FIRST; per-repo copies are re-synced from it, never hand-edited.
//
// WHY 410 AND NOT 404
// ------------------
// `is_published = false` (with `deserve_reason` set) is the DE-SERVE flag written by
// the 2026-07-12 legal arc (1,848,564 rows across 21 tables; see
// empire-legal-audit/A_deserve.sql). Those URLs are PERMANENTLY WITHDRAWN, not
// missing. 404 says "not found (maybe later)" and Google will re-crawl it for a long
// time; 410 says "gone, permanently" and Google drops the URL materially faster.
// There is NO Search Console Removals API (the API exposes only searchanalytics,
// sitemaps, sites, urlInspection, urlTestingTools), so a bulk removal is unavailable
// — 410 + X-Robots-Tag: noindex is the primary de-index lever we have.
//
// WHY THIS RUNS IN MIDDLEWARE
// ---------------------------
// Next.js App Router `notFound()` hard-codes HTTP 404 and a page/Server Component has
// no way to set a response status. Middleware is the only place that can return a TRUE
// 410 status line for a page route. Verified with `curl -I`, not inferred.
//
// WHY IT CANNOT LEAK THE ROW
// --------------------------
// It never selects the row. It calls the SECURITY DEFINER RPC `is_deserved_listing`,
// which returns a BARE BOOLEAN. By construction no field of a de-served row (name,
// address, license, anything) can reach this process, let alone the response body.
// The RPC is structurally gated to `*_listings` tables carrying the de-serve column
// contract, so the anon key cannot probe arbitrary tables.
//
// WHY THE 410 NOW CARRIES A BODY (K148, ruling 2026-09-02)
// --------------------------------------------------------
// A de-serve removes the row; it does not remove the traffic. Google keeps serving its
// last crawl of a withdrawn URL for weeks, and the people clicking are disproportionately
// the SUBJECTS themselves (name lookups). notary: 98.9% of 2,271 detail clicks/28d landed
// on this 410 — with a null body, a dead end for exactly the person K38 exists to let
// claim. The body below is a CONSTANT string with ONLY the slug substituted into the href.
// No name, no address, no phone, no field of the row — the slug is already in the
// visitor's URL bar, so it discloses nothing new. K38 stays intact: no name, no data, no
// index (`X-Robots-Tag: noindex`, `Cache-Control: no-store` unchanged; the sitemap is
// untouched; no recrawl is triggered — the stale index IS the traffic). The link is
// consent-seeking: /claim/<slug> lets the subject claim the record or ask for removal, and
// `?src=gone_page` lands in claim_attribution so the effect is measurable.
//
// FAIL-OPEN, SAFELY
// -----------------
// Any error (missing env, network, non-200 RPC) returns null => the request falls
// through to the page, whose getListing() already filters `is_published = false` and
// therefore still 404s and still NEVER renders the row. The gate can only ever UPGRADE
// a 404 to a 410; it can never cause a de-served row to render, and it can never 410 a
// live or a genuinely-nonexistent slug.
//
// PRECISION
// ---------
// Only `is_published = false AND deserve_reason IS NOT NULL` is a de-serve. Rows that
// are unpublished for other reasons (e.g. the M6 unpublished set: ther=21,587,
// acct=19, dent=2 rows with a NULL deserve_reason) are NOT de-serves and keep their
// 404. A slug with no row at all keeps its 404. We do not blanket-410 the route.

import { NextRequest, NextResponse } from "next/server";
import verticalConfig from "@/lib/vertical.config";

export const DESERVE_GATE_VERSION = "1.1.0";

// Matches EXACTLY the listing-detail routes: /directory/<slug> and /uk/directory/<slug>.
// Nothing else on the site is gated.
const LISTING_PATH = /^\/(?:uk\/)?directory\/([^/]+)\/?$/;

const LISTINGS_TABLE = `${verticalConfig.tablePrefix}listings`;

// The site name is the only per-vertical value in the body, and it comes from config —
// never from the row. Optional: a repo whose config lacks `name` renders the plain title.
const SITE_NAME: string = (verticalConfig as { name?: unknown }).name
  ? String((verticalConfig as { name?: unknown }).name)
  : "";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The withdrawn-page body. Constant copy (ruling 2026-09-02 — tone is deliberate); the
// ONLY substitution is the slug into the claim href. No nav chrome, no footer, no scripts,
// no analytics — it is a 410. The claim link is root-relative so it works on every host
// this file is shared into.
export function goneBody(slug: string): string {
  const href = `/claim/${encodeURIComponent(slug)}?src=gone_page`;
  const title = SITE_NAME
    ? `This page has been withdrawn | ${escapeHtml(SITE_NAME)}`
    : "This page has been withdrawn";
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${title}</title></head><body>` +
    `<h1>This page has been withdrawn</h1>` +
    `<p>The listing that was here is no longer published.</p>` +
    `<p>If you are the professional it referred to, you can claim it or ask for it to be removed:</p>` +
    `<p><a href="${escapeHtml(href)}">Claim this listing</a></p>` +
    `<p><a href="/">Return to the directory</a></p>` +
    `</body></html>`
  );
}

export async function deserveGate(req: NextRequest): Promise<NextResponse | null> {
  const match = LISTING_PATH.exec(req.nextUrl.pathname);
  if (!match) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null; // malformed escape — let the page 404 it
  }
  if (!slug) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // fail open -> page still 404s de-served rows

  let deserved = false;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/is_deserved_listing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ p_table: LISTINGS_TABLE, p_slug: slug }),
      cache: "no-store",
    });
    if (!res.ok) return null; // fail open
    deserved = (await res.json()) === true;
  } catch {
    return null; // fail open
  }

  if (!deserved) return null;

  // TRUE 410 status line. Nameless constant body carrying only the claim link (K148):
  // the response carries no row data whatsoever.
  return new NextResponse(goneBody(slug), {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
