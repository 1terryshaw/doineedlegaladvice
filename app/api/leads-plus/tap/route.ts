// leads-plus-canary-v1 — contact-button tap counter (Call / Email / Visit website / WhatsApp).
// Taps are counted, never treated as leads. Only Leads Plus pages (gate open) are counted, so no
// write ever happens for the 110k other listings. Always 204: a counter must never break a click.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { leadFormGate, TAP_KINDS, TAP_INC_RPC, type TapKind } from "@/lib/leads-plus";
import { getGateRow } from "@/lib/leads-plus-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { listingSlug?: string; kind?: string } | null;
    const kind = body?.kind as TapKind | undefined;
    const slug = typeof body?.listingSlug === "string" ? body.listingSlug.slice(0, 200) : "";
    if (!slug || !kind || !TAP_KINDS.includes(kind)) return new NextResponse(null, { status: 204 });
    if (/bot|crawler|spider|GPTBot|ClaudeBot|anthropic-ai|PerplexityBot|CCBot|Bytespider/i.test(req.headers.get("user-agent") || "")) return new NextResponse(null, { status: 204 });
    const row = await getGateRow(slug);
    if (!row || !leadFormGate(row).ok) return new NextResponse(null, { status: 204 });
    const { error } = await supabaseAdmin.rpc(TAP_INC_RPC, { p_listing: row.id, p_kind: kind });
    if (error) console.error("[leads-plus/tap]", error.message);
  } catch (e) {
    console.error("[leads-plus/tap]", (e as Error).message);
  }
  return new NextResponse(null, { status: 204 });
}
