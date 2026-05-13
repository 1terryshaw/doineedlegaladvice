import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { sendClaimEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { slug, email, name } = await request.json();

  if (!slug || !email || !name) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, claimed")
    .eq("slug", slug)
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.claimed) {
    return NextResponse.json({ error: "This listing has already been claimed" }, { status: 400 });
  }

  const token = generateToken();

  const { error: updateError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({
      owner_auth_token: token,
      owner_email: email,
    })
    .eq("id", listing.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to process claim" }, { status: 500 });
  }

  await sendClaimEmail(email, slug, token);

  return NextResponse.json({ success: true });
}
