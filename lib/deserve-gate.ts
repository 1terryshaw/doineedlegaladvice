// COMPLIANCE / SEO — 410 Gone gate for DE-SERVED listing rows.
// SHARED FILE: byte-identical across all 21 de-served verticals. Do not fork.
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
// address, license, anything) can reach this process, let alone the response body —
// the 410 is emitted with a null body. The RPC also allow-lists the 21 tables so the
// anon key cannot probe arbitrary tables.
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

// Matches EXACTLY the listing-detail routes: /directory/<slug> and /uk/directory/<slug>.
// Nothing else on the site is gated.
const LISTING_PATH = /^\/(?:uk\/)?directory\/([^/]+)\/?$/;

const LISTINGS_TABLE = `${verticalConfig.tablePrefix}listings`;

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

  // TRUE 410 status line. Null body: the response carries no row data whatsoever.
  return new NextResponse(null, {
    status: 410,
    headers: {
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
