// 410 Gone gate for DE-SERVED listing rows. See lib/deserve-gate.ts for the full
// rationale (why 410 and not 404, why middleware, why it cannot leak the row).
//
// Scoped by `matcher` to the listing-detail routes ONLY, so this middleware never
// touches any other request on the site.

import { NextRequest, NextResponse } from "next/server";
import { deserveGate } from "@/lib/deserve-gate";

export async function middleware(req: NextRequest) {
  const gone = await deserveGate(req);
  if (gone) return gone;
  return NextResponse.next();
}

export const config = {
  // NOTE: use `:path*`, NOT `:slug`. Next.js 14 compiles a bare `/directory/:slug`
  // matcher down to `^\/directory(?:\/(.json))?[\/#\?]?$` — which matches ONLY
  // `/directory` and NEVER `/directory/<slug>`, so the middleware silently never runs.
  // Verified against .next/server/middleware-manifest.json, not assumed. `:path*` also
  // matches the bare `/directory` index, which is fine: deserveGate()'s own LISTING_PATH
  // regex is the real filter and returns null for anything that isn't a listing detail.
  matcher: ["/directory/:path*", "/uk/directory/:path*"],
};
