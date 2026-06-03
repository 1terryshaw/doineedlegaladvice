import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE, INQUIRIES_TABLE } from "@/lib/supabase";
import { sendInquiryNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { listingSlug, name, email, phone, message } = await request.json();

  if (!listingSlug || !name || !email || !message) {
    return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, name, owner_email")
    .eq("slug", listingSlug)
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Store inquiry
  const { data: inquiry } = await supabaseAdmin.from(INQUIRIES_TABLE).insert({
    listing_id: listing.id,
    name,
    email,
    phone: phone || null,
    message,
  }).select("reply_token").single();

  // Send notification if owner has email
  if (listing.owner_email) {
    await sendInquiryNotification(listing.owner_email, listing.name, {
      name,
      email,
      phone,
      message, replyToken: inquiry?.reply_token }, listingSlug);
  }

  return NextResponse.json({ success: true });
}
