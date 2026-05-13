import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getAuthFromCookies } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!auth) {
    return NextResponse.redirect(`${siteUrl}/owner/login`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("stripe_customer_id, owner_auth_token")
    .eq("slug", auth.slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (error || !listing || !listing.stripe_customer_id) {
    return NextResponse.redirect(`${siteUrl}/pricing`);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: listing.stripe_customer_id,
    return_url: `${siteUrl}/owner/${auth.slug}`,
  });

  return NextResponse.redirect(session.url);
}
