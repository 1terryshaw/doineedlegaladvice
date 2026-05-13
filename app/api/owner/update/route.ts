import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";
import { sanitizeExtras, EXTRA_UPDATE_FIELDS } from "@/lib/listing-extras";
import { BUCKET } from "@/lib/owner-form-bucket";

export const dynamic = "force-dynamic";

// Wire-format keys the form sends. The route maps "name" + "province_state"
// onto the bucket-specific DB columns via lib/owner-form-bucket.
const PASSTHROUGH_FIELDS = [
  "short_description",
  "description",
  "phone",
  "email",
  "website",
  "city",
] as const;

// Accept https://x, http://x, www.x, x — store canonical https://… form.
// Empty string explicitly clears the field.
function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { slug, ...updates } = body;

  if (!slug || auth.slug !== slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listing, error: fetchError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token")
    .eq("slug", slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (fetchError || !listing) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeUpdates: Record<string, unknown> = {};

  for (const field of PASSTHROUGH_FIELDS) {
    if (field in updates && typeof updates[field] === "string") {
      safeUpdates[field] =
        field === "website" ? normalizeWebsite(updates[field]) : updates[field];
    }
  }

  // Bucket-mapped fields. Form always sends "name" + "province_state";
  // we write to the actual DB columns for this repo's bucket.
  if ("name" in updates && typeof updates.name === "string") {
    safeUpdates[BUCKET.nameColumn] = updates.name;
  }
  if ("province_state" in updates && typeof updates.province_state === "string") {
    safeUpdates[BUCKET.provinceColumn] = updates.province_state;
  }

  const extrasInput: Record<string, unknown> = {};
  for (const k of EXTRA_UPDATE_FIELDS) {
    if (k in updates) extrasInput[k] = updates[k];
  }
  Object.assign(safeUpdates, sanitizeExtras(extrasInput));

  safeUpdates.updated_at = new Date().toISOString();
  safeUpdates.owner_last_action_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update(safeUpdates)
    .eq("id", listing.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update", detail: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
