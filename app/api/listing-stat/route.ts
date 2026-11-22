// proof-of-life-stats-email-v1 — minimal per-listing counters (views / phone clicks / website clicks).
//
// Feeds public.listing_stats_daily via the service-role-only listing_stat_inc() RPC; the monthly
// "proof of life" owner email reads public.listing_stats_30d.
//
// PRIVACY: nothing about the visitor is stored — no IP, no hash, no UA, no session id. Only a +1 on a
// per-listing daily aggregate. Dedup (one view per listing per browser session) happens client-side
// in ListingStatsBeacon via sessionStorage.
// LOAD: only CLAIMED, published rows are counted (the email only goes to claimed owners), so the write
// volume is bounded by claimed-listing traffic, not the whole corpus. Bots are dropped.
// Always 204: a counter must never break a page or a click.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const KINDS = new Set(["view", "phone", "website"]);
const BOT_UA = /bot|crawler|spider|crawl|slurp|GPTBot|ClaudeBot|anthropic-ai|claude-web|PerplexityBot|Perplexity-User|CCBot|Bytespider|Google-Extended|GoogleOther|facebookexternalhit|Amazonbot|Applebot|headless|lighthouse|curl|wget|python-requests|node-fetch/i;

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });
    const body = (await req.json().catch(() => null)) as { listingSlug?: unknown; kind?: unknown } | null;
    const slug = typeof body?.listingSlug === "string" ? body.listingSlug.slice(0, 200) : "";
    const kind = typeof body?.kind === "string" ? body.kind : "";
    if (!slug || !KINDS.has(kind)) return new NextResponse(null, { status: 204 });

    const { data: row } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, claimed, is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (!row || row.claimed !== true || row.is_published === false) return new NextResponse(null, { status: 204 });

    const { error } = await supabaseAdmin.rpc("listing_stat_inc", { p_table: LISTINGS_TABLE, p_listing: row.id, p_kind: kind });
    if (error) console.error("[listing-stat]", error.message);
  } catch (e) {
    console.error("[listing-stat]", (e as Error).message);
  }
  return new NextResponse(null, { status: 204 });
}
