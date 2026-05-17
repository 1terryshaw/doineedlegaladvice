import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthFromCookies, verifyOwnerAccess } from '@/lib/auth';
import { signBillingHandoff } from '@/lib/billing-handoff';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (!auth) {
    return NextResponse.redirect(`${siteUrl}/owner/login`, 303);
  }

  const access = await verifyOwnerAccess(auth.slug);
  if (!access) {
    return NextResponse.redirect(`${siteUrl}/owner/login`, 303);
  }

  const listing = access.listing;
  const ownerEmail: string | undefined = listing.owner_email || listing.email;
  if (!ownerEmail) {
    return NextResponse.redirect(`${siteUrl}/pricing`, 303);
  }

  const token = await signBillingHandoff({
    vertical: process.env.BILLING_VERTICAL_SLUG!,
    listing_slug: auth.slug,
    owner_email: ownerEmail,
    tier: 'reviews_plus', // placeholder — portal doesn't use tier
    cycle: 'monthly', // placeholder — portal doesn't use cycle
  });

  const billingBase = process.env.BILLING_SERVICE_URL!;
  const vertical = process.env.BILLING_VERTICAL_SLUG!;
  const url = `${billingBase}/api/portal?token=${encodeURIComponent(token)}&vertical=${encodeURIComponent(vertical)}`;
  return NextResponse.redirect(url, 303);
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
