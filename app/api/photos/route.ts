import { NextRequest, NextResponse } from "next/server";
import { listPhotosForListing, VERTICAL_KEY } from "@/lib/listing-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listing_id");
  const vertical = searchParams.get("vertical");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
  }
  if (vertical && vertical !== VERTICAL_KEY) {
    return NextResponse.json({ photos: [], logo: null });
  }

  const result = await listPhotosForListing(listingId);
  return NextResponse.json(result);
}
