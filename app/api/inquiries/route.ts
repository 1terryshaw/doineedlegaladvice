// NO FREE LEADS (leads-plus-canary-v1 addendum A, CEO 2026-10-09): the legacy free inquiry path is REMOVED.
// Free and unclaimed listings get no inquiry form at all; a Leads Plus listing takes inquiries only through
// /api/leads-plus/lead (gated: claimed + owner email confirmed + Leads Plus + leads_plus_enabled).
// Any POST here — a stale page or a crafted request — is refused, nothing is stored or sent.
// The previous implementation lives in git history (tag working-v-leadsplus-r11-pre).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ error: "This business is not accepting online inquiries." }, { status: 403 });
}
