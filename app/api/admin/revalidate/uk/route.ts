export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { revalidateUkSlugs, UK_REVALIDATE_MAX_SLUGS } from "@/lib/uk-revalidate";

// On-demand ISR purge for the /uk subtree (K32, 2026-08-24). Guarded by the fleet-standard
// REVALIDATE_SECRET Bearer token (fail-closed if unset) — NOT public.
//
// The /uk leaf and the /uk root hub are on revalidate=86400. Call this the instant a row is
// unpublished/removed and the leaf goes 404 immediately instead of serving a cached 200 with
// the name rendered for up to 24h; call it on republish and the cached 404 clears so the page
// regenerates and goes live immediately. Same call, both directions — purging a path clears
// whatever is cached there.
//
// Mounted at /uk rather than the fleet's bare /api/admin/revalidate because the mechanism is
// different: the fleet endpoint busts `listing:${slug}` unstable_cache tags on the CA/US
// listings, which this repo's /uk routes do not use. The bare path is left free for that.
//
// Body: { "slugs": ["a8e18484-0119-4e69-8412-a47d4fe8a1ef", ...] }  (row id = the leaf slug here)
// Auth: Authorization: Bearer $REVALIDATE_SECRET

function authorized(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false; // fail closed
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { slugs?: unknown })?.slugs;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "slugs[] required" }, { status: 400 });
  }
  const slugs = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
  if (slugs.length === 0) {
    return NextResponse.json(
      { error: "slugs[] must contain at least one non-empty string" },
      { status: 400 }
    );
  }
  if (slugs.length > UK_REVALIDATE_MAX_SLUGS) {
    return NextResponse.json(
      { error: `too many slugs (max ${UK_REVALIDATE_MAX_SLUGS})` },
      { status: 400 }
    );
  }

  const { paths, errors } = await revalidateUkSlugs(slugs);
  return NextResponse.json({ slugs: slugs.length, revalidated: paths.length, paths, errors });
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "POST { slugs: string[] } with a Bearer REVALIDATE_SECRET." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
