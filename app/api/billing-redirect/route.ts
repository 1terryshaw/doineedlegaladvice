import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerAccess } from '@/lib/auth';
import { signBillingHandoff } from '@/lib/billing-handoff';
import { verticalAllowsLeadForms } from '@/lib/leads-plus';

export const dynamic = 'force-dynamic';

type Body = {
  listingSlug?: string;
  tier?: 'reviews_plus' | 'website' | 'growth' | 'leads_plus';
  cycle?: 'monthly' | 'annual';
  mode?: 'trial' | 'direct';
};

export async function POST(request: NextRequest) {
  let body: Body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { listingSlug, mode } = body;
  let { tier, cycle } = body;
  if (!listingSlug || !tier || !cycle) {
    return NextResponse.json({ error: 'Missing listingSlug, tier, or cycle' }, { status: 400 });
  }
  if (!['reviews_plus', 'website', 'growth', 'leads_plus'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }
  if (!['monthly', 'annual'].includes(cycle)) {
    return NextResponse.json({ error: 'Invalid cycle' }, { status: 400 });
  }
  // R11 GO (leads-plus-canary-v1): a NEW Reviews Plus checkout is sold as Leads Plus $19 (monthly only).
  // Owners with an existing $9 sub land on billing's no-op path ("already on this plan") — their sub is untouched.
  if (tier === 'reviews_plus') { tier = 'leads_plus'; cycle = 'monthly'; }
  // 'trial' mirrors Reviews Plus exactly (30 days, card at signup) for reviews_plus / leads_plus / website.
  // Growth is direct-purchase only; anything else (or absent) bills immediately.
  const checkoutMode: 'trial' | 'direct' =
    mode === 'trial' && (tier === 'leads_plus' || tier === 'website')
      ? 'trial'
      : 'direct';

  const access = await verifyOwnerAccess(listingSlug);
  if (!access) {
    return NextResponse.json({ error: 'Not authorized for this listing' }, { status: 401 });
  }

  const listing = access.listing;

  // Leads Plus ($19 USD/mo) — R11 GO: sold to every claimed owner on this site (R4 verticals never).
  // Monthly only (R5). The purchase itself turns the listing's leads_plus_enabled on (empire-billing webhook).
  if (tier === 'leads_plus') {
    if (!verticalAllowsLeadForms()) {
      return NextResponse.json({ error: 'Leads Plus is not available for this listing yet.' }, { status: 403 });
    }
    if (cycle !== 'monthly') {
      return NextResponse.json({ error: 'Leads Plus is monthly only' }, { status: 400 });
    }
  }
  const ownerEmail: string | undefined = listing.owner_email || listing.email;
  if (!ownerEmail || ownerEmail.trim() === '') {
    return NextResponse.json(
      { error: 'No owner email on file. Contact support.' },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await signBillingHandoff({
      vertical: process.env.BILLING_VERTICAL_SLUG!,
      listing_slug: listingSlug,
      owner_email: ownerEmail,
      tier, cycle,
      mode: checkoutMode,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Billing handoff signing failed' }, { status: 500 });
  }

  const billingBase = process.env.BILLING_SERVICE_URL;
  const vertical = process.env.BILLING_VERTICAL_SLUG!;
  if (!billingBase) {
    return NextResponse.json({ error: 'BILLING_SERVICE_URL not set' }, { status: 500 });
  }

  // Call billing service server-side and forward the response.
  // `mode` travels inside the signed handoff token — empire-billing reads it
  // from the verified payload, so it cannot be tampered with in transit.
  const url = `${billingBase}/api/checkout?token=${encodeURIComponent(token)}&vertical=${encodeURIComponent(vertical)}`;
  try {
    const billingRes = await fetch(url, { method: 'GET' });
    const text = await billingRes.text();
    let billingData;
    try { billingData = JSON.parse(text); }
    catch { return NextResponse.json({ error: 'Billing service returned invalid response', status: billingRes.status, body: text.slice(0, 200) }, { status: 502 }); }
    return NextResponse.json(billingData, { status: billingRes.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'Billing service unreachable', detail: e.message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
