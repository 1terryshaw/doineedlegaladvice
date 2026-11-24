// proof-of-life-stats-email-v1 — minimal per-listing counters (views / phone clicks / website clicks).
//
// Feeds public.listing_stats_daily via the service-role-only listing_stat_inc() RPC; the weekly
// "proof of life" owner email reads it.
//
// PRIVACY: nothing about the visitor is stored — no IP, no hash, no UA, no session id. Only a +1 on a
// per-listing daily aggregate. Dedup (one view per listing per browser session) happens client-side
// in ListingStatsBeacon via sessionStorage.
// INTEGRITY (beacon v2, lib/listing-stat-filter.ts): bots/automation, cross-site posts and the listing's
// OWNER (identified only by the site's existing owner-session cookie for this slug — no new tracking)
// are not counted. The owner case answers `x-ls-owner: 1` so the browser can remember its owner device.
// LOAD: only CLAIMED, published rows are counted. Always 204: a counter must never break a page or a click.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";
import { serverSkipReason } from "@/lib/listing-stat-filter";

export const dynamic = "force-dynamic";

const KINDS = new Set(["view", "phone", "website"]);
const noContent = (owner = false) => new NextResponse(null, { status: 204, headers: owner ? { "x-ls-owner": "1", "cache-control": "no-store" } : { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { listingSlug?: unknown; kind?: unknown } | null;
    const slug = typeof body?.listingSlug === "string" ? body.listingSlug.slice(0, 200) : "";
    const kind = typeof body?.kind === "string" ? body.kind : "";
    if (!slug || !KINDS.has(kind)) return noContent();

    let ownerCookieSlug: string | null = null;
    try { ownerCookieSlug = getAuthFromCookies(await cookies())?.slug ?? null; } catch { ownerCookieSlug = null; }
    const skip = serverSkipReason({
      ua: req.headers.get("user-agent"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      ownerCookieSlug,
      slug,
    });
    if (skip) return noContent(skip === "owner");

    const { data: row } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, claimed, is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (!row || row.claimed !== true || row.is_published === false) return noContent();

    const { error } = await supabaseAdmin.rpc("listing_stat_inc", { p_table: LISTINGS_TABLE, p_listing: row.id, p_kind: kind });
    if (error) console.error("[listing-stat]", error.message);
  } catch (e) {
    console.error("[listing-stat]", (e as Error).message);
  }
  return noContent();
}
