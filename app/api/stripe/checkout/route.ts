import { NextResponse } from "next/server";

/**
 * TDL #1388 — DISABLED. This route created a live Stripe Checkout session for any
 * client-supplied priceId with no authentication (a second seller outside empire-billing).
 * Paid plans are sold only through empire-billing (/api/billing-redirect → signed hand-off).
 */
function gone() {
  return NextResponse.json(
    { error: "gone", detail: "Checkout moved to empire-billing." },
    { status: 410 }
  );
}

export const POST = gone;
export const GET = gone;
