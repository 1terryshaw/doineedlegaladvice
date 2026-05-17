import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";
import { canonical } from "@/lib/vertical-canonical";
import {
  ACCEPTED_MIME,
  MAX_PHOTO_BYTES,
} from "@/lib/listing-extras";
import {
  PHOTO_BUCKET,
  VERTICAL_KEY,
  buildStoragePath,
  publicUrlFor,
  nextPhotoSlot,
  existingLogoId,
  type PhotoKind,
} from "@/lib/listing-photos";
import { photoLimitForTier } from "@/lib/photo-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listing, error: fetchError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, owner_auth_token, owner_email, tier, subscription_tier")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (fetchError || !listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const kindRaw = String(formData.get("photo_kind") ?? "photo");
  const kind: PhotoKind = kindRaw === "logo" ? "logo" : "photo";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported type. Use jpeg, png, or webp." },
      { status: 400 }
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_PHOTO_BYTES / 1024 / 1024}MB).` },
      { status: 400 }
    );
  }

  const listingId = listing.id as string;
  let displayOrder = 0;

  if (kind === "photo") {
    const photoLimit = photoLimitForTier(listing.tier || listing.subscription_tier);
    const slot = await nextPhotoSlot(listingId, photoLimit);
    if (slot === null) {
      return NextResponse.json(
        { error: `Maximum ${photoLimit} photos.` },
        { status: 400 }
      );
    }
    displayOrder = slot;
  } else {
    const existing = await existingLogoId(listingId);
    if (existing) {
      return NextResponse.json(
        { error: "Logo already exists. Delete the current logo first." },
        { status: 400 }
      );
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(buf)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not process image." }, { status: 400 });
  }

  const uuid = randomUUID();
  const storagePath = buildStoragePath(listingId, kind, uuid);

  const { error: uploadError } = await supabaseAdmin
    .storage.from(PHOTO_BUCKET)
    .upload(storagePath, webp, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const publicUrl = publicUrlFor(storagePath);

  const { data: row, error: insertError } = await supabaseAdmin
    .from("listing_photos")
    .insert({
      vertical: VERTICAL_KEY,
      listing_table: LISTINGS_TABLE,
      listing_id: listingId,
      photo_kind: kind,
      storage_path: storagePath,
      public_url: publicUrl,
      display_order: displayOrder,
      uploaded_by_email: listing.owner_email ?? null,
    })
    .select("id, public_url, display_order, photo_kind")
    .single();

  if (insertError || !row) {
    await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }

  await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listingId);

  return NextResponse.json({
    id: row.id,
    public_url: row.public_url,
    display_order: row.display_order,
    photo_kind: row.photo_kind,
    vertical: VERTICAL_KEY,
    base_url: process.env.NEXT_PUBLIC_BASE_URL || (canonical.domain ? `https://${canonical.domain}` : ""),
  });
}
