import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";
import { PHOTO_BUCKET, VERTICAL_KEY, publicUrlFor } from "@/lib/listing-photos";
import { can } from "@/lib/tier-capabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface AuthedListing {
  id: string;
  tier: string | null;
  subscription_tier: string | null;
}

async function authListing(): Promise<AuthedListing | null> {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  if (!auth) return null;
  const { data: listing } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, tier, subscription_tier")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();
  return (listing as AuthedListing | null) ?? null;
}

// POST — upload a hero cover image and store its URL on the listing.
export async function POST(request: NextRequest) {
  const listing = await authListing();
  if (!listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(listing.tier || listing.subscription_tier, "reviews_display")) {
    return NextResponse.json(
      { error: "Hero cover image is a Reviews Plus feature" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5MB" }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: "Only jpeg, png, or webp accepted" }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let resized: Buffer;
  try {
    resized = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 2400, height: 800, fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Image processing failed" }, { status: 400 });
  }

  const storagePath = `${VERTICAL_KEY}/${listing.id}/hero/${randomUUID()}.webp`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, resized, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const heroUrl = publicUrlFor(storagePath);
  const { error: updateError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ hero_image_url: heroUrl })
    .eq("id", listing.id);
  if (updateError) {
    await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  return NextResponse.json({ hero_image_url: heroUrl });
}

// DELETE — clear the hero cover image.
export async function DELETE() {
  const listing = await authListing();
  if (!listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ hero_image_url: null })
    .eq("id", listing.id);
  if (error) {
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
