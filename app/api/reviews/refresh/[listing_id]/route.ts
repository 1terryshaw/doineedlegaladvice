/**
 * POST /api/reviews/refresh/[...]
 *
 * DE-GOOGLED (TDL #496): this vertical does not use the Google Places API.
 * The canadaforyou implementation fetched reviews from places.googleapis.com;
 * that call is intentionally removed (DE-GOOGLE IS ABSOLUTE / no paid Google APIs).
 *
 * Endpoint retained (callers get a clean, explicit response) but is a no-op until a
 * de-Googled review source is wired up in a later session.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { ok: false, disabled: true, reason: "Reviews refresh is disabled (de-Googled vertical)." },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
