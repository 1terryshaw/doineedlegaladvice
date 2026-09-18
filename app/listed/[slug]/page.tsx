import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LANE_ROBOTS, lanePublicUrl } from "@/lib/lane-gate";
import {
  laneMetaDescription, laneStructuredData, laneTitle, renderLaneBodyHtml, type LaneListing,
} from "@/lib/lane-render";
import { publishedLaneRowBySlug } from "@/lib/lane-store";

export const dynamic = "force-dynamic";

/**
 * THE PUBLIC LANE PAGE (spec §3).
 *
 * ── WHY `/listed/*` AND NOT `/directory/*` — REQUIRED, NOT COSMETIC ─────────────────
 * `middleware.ts`'s matcher is `["/directory/:path*", "/uk/directory/:path*"]` and it runs the
 * 410 de-serve gate. A lane URL under `/directory` would inherit that gate, and the lane would
 * be sharing a serving decision with a table it must never be joined to. It lives outside it,
 * and `middleware.ts` needs no change and gets none (PS-L9).
 *
 * `/listed/*` sits beside the top-level dynamic segment `app/[region]`. A STATIC segment wins
 * over a dynamic sibling in the App Router, and "listed" is not in `US_STATE_CODES`, so
 * nothing is displaced.
 *
 * ── 🔴 A MISSING RELATION IS A 404, NOT A 500 (§5.5) ────────────────────────────────
 * Between the deploy (§8.5 step 4) and the migration (step 5) the lane tables do not exist. A
 * public URL must not serve a stack trace, so the store catches the missing-relation error and
 * returns null, and null is `notFound()`. The POST routes deliberately do NOT do this —
 * wrapping a write would risk reporting a failed write as a success.
 */
async function load(slug: string): Promise<LaneListing | null> {
  const row = await publishedLaneRowBySlug(slug);
  if (!row) return null;
  return {
    business_name: row.business_name, contact_name: row.contact_name, address_line: row.address_line,
    city: row.city, region_state: row.region_state, postal_code: row.postal_code, country: row.country,
    phone: row.phone, website: row.website, public_email: row.public_email,
    description: row.description, slug: row.slug,
  };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const row = await load(params.slug);
  if (!row) return { title: "Not found", robots: LANE_ROBOTS };
  return {
    title: laneTitle(row),
    description: laneMetaDescription(row),
    // 🔴 THE VALUE COMES FROM THE MODULE, NEVER SPELLED HERE. A literal in this file is a
    // second definition free to drift from the one PS-L5 asserts by importing.
    robots: LANE_ROBOTS,
    // Self-canonical. Never into /directory — that would fold the page into the hierarchy the
    // disclaimer denies.
    alternates: { canonical: lanePublicUrl(row.slug) },
  };
}

export default async function ListedPage({ params }: { params: { slug: string } }) {
  const row = await load(params.slug);
  if (!row) notFound();

  const graph = laneStructuredData(row);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
      {/*
        The body is a PURE STRING RENDER. §3.1's assertion is a BYTE OFFSET — the disclaimer
        marker at offset 0 of the lane's own output, before the `<h1>` — and a JSX tree cannot
        be asserted that way without a renderer. A pure function is assertable with no deploy,
        no database and no React (`feedback_render_proof_needs_no_deploy`). This component's
        whole job is to drop that string into `<main>`, which `app/layout.tsx:33` wraps around
        `{children}` directly — so "first node this page returns" IS "first element inside
        <main>".
      */}
      <div dangerouslySetInnerHTML={{ __html: renderLaneBodyHtml(row) }} />
      {/*
        A bare LocalBusiness. NOT LegalService (a LocalBusiness subtype carrying exactly the
        professional-services implicature this page denies), no AggregateRating, no
        hasOfferCatalog, and NO BreadcrumbList — a breadcrumb would place this page inside the
        directory's own hierarchy, the graph-level version of the claim the disclaimer denies.
        `laneStructuredData` REFUSES (throws) on any banned key rather than omitting it.
      */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    </div>
  );
}
