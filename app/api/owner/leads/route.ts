import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthFromCookies } from "@/lib/auth";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify token against listing
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, owner_auth_token")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const listingId = `${verticalConfig.tablePrefix}listings:${listing.id}`;

  const { data: leads, error: leadsErr } = await supabaseAdmin
    .from("leads_forwarded")
    .select(
      "id, visitor_name, visitor_email, visitor_phone, message, service_needed, urgency, delivery_status, created_at"
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (leadsErr) {
    console.error("Failed to fetch leads:", leadsErr.message);
    return NextResponse.json({ leads: [] });
  }

  return NextResponse.json({ leads: leads || [] });
}
