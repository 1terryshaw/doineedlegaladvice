// app/api/cost-estimate/route.ts — VERTICAL-AGNOSTIC Cost Estimator endpoint.
// Input: { service, complexity?, region? } via POST JSON body or GET query params.
// Output: { low, high, currency, currency_symbol, market, unit, n_pros_nearby, … }
// computed server-side from cost_models + region_modifiers (service-role). The
// vertical is resolved inside estimateCost() from empire_verticals.

import { NextRequest, NextResponse } from "next/server";
import { estimateCost } from "@/lib/cost-models";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function handle(params: {
  service?: string | null;
  complexity?: string | null;
  region?: string | null;
}) {
  const service = (params.service || "").trim();
  if (!service) {
    return NextResponse.json({ error: "Missing required field: service" }, { status: 400 });
  }
  const estimate = await estimateCost({
    service,
    complexity: params.complexity ?? null,
    region: params.region ?? null,
  });
  if (!estimate) {
    return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 404 });
  }
  return NextResponse.json(estimate, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle({ service: sp.get("service"), complexity: sp.get("complexity"), region: sp.get("region") });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return handle({
    service: typeof body.service === "string" ? body.service : null,
    complexity: typeof body.complexity === "string" ? body.complexity : null,
    region: typeof body.region === "string" ? body.region : null,
  });
}
