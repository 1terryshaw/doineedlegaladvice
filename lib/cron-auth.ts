import { NextRequest, NextResponse } from "next/server";

/**
 * Verify cron requests using Bearer token auth.
 * Returns null if authorized, or an error NextResponse if not.
 */
export function verifyCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
