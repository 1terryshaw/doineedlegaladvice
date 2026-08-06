import { NextRequest, NextResponse } from "next/server";
import { resolveGoogleBusinessProfileUrl } from "@/lib/gbp-connector";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

function coarseError(code: string): "unsupported_url" | "resolution_failed" { return code === "invalid_url" || code === "unsupported_google_link" || code === "redirect_left_google" ? "unsupported_url" : "resolution_failed"; }

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const prior = attempts.get(ip);
  const current = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : prior;
  current.count += 1; attempts.set(ip, current);
  if (current.count > MAX_ATTEMPTS) return NextResponse.json({ resolved: false, error: "resolution_failed" }, { status: 429, headers: { "Retry-After": "60" } });
  try {
    const body = await request.json();
    if (!body || typeof body.googleMapsUrl !== "string" || !body.googleMapsUrl.trim() || body.googleMapsUrl.length > 2048) return NextResponse.json({ resolved: false, error: "invalid_request" }, { status: 400 });
    const result = await resolveGoogleBusinessProfileUrl(body.googleMapsUrl);
    if (!result.ok) return NextResponse.json({ resolved: false, error: coarseError(result.code) }, { status: 422 });
    return NextResponse.json({ resolved: true, placeId: result.placeId });
  } catch { return NextResponse.json({ resolved: false, error: "invalid_request" }, { status: 400 }); }
}
