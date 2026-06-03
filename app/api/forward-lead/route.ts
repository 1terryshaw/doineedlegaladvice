import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE, INQUIRIES_TABLE } from "@/lib/supabase";
import { sendInquiryNotification } from "@/lib/email";
import { sendLeadForwardEmail, sendInquiryConfirmation } from "@/lib/resend";
import { sendLeadForwardSMS } from "@/lib/twilio";
import { can } from "@/lib/tier-capabilities";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_URGENCY = ["emergency", "urgent", "flexible"] as const;

// Server-side email-format gate. The form has a client-side check, but a
// malformed address that slips through would silently produce an
// undeliverable lead and a bounced prospect confirmation. Reject it here so
// the visitor gets a clean 400. Standard "looks like an email" shape:
// non-empty local part, "@", non-empty domain with a dot.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: {
    listingSlug: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    serviceNeeded?: string;
    urgency?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { listingSlug, name, email, phone, message, serviceNeeded } = body;
  const urgency = VALID_URGENCY.includes(body.urgency as any)
    ? (body.urgency as string)
    : "flexible";

  if (!listingSlug || !name || !email || !message) {
    return NextResponse.json(
      { error: "Required fields: listingSlug, name, email, message" },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  // Look up listing
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, name, owner_email, phone, email, tier, subscription_tier, claimed")
    .eq("slug", listingSlug)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const tier = listing.tier || listing.subscription_tier || "free";
  const businessEmail = listing.owner_email || listing.email;
  const businessPhone = listing.phone;
  const listingId = `${verticalConfig.tablePrefix}listings:${listing.id}`;

  const visitorIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const visitorUserAgent = request.headers.get("user-agent") || null;

  // ── LEAD BOOST+ PATH: forward via Resend + Twilio ──────────────────
  if (can(tier, "lead_forwarding") && businessEmail) {
    const [emailResult, smsResult] = await Promise.allSettled([
      sendLeadForwardEmail({
        businessName: listing.name,
        businessEmail,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        message,
        serviceNeeded,
        urgency,
      }),
      businessPhone
        ? sendLeadForwardSMS(businessPhone, name, listing.name)
        : Promise.resolve({ success: false, error: "no_phone" }),
      // Branded confirmation to the prospect (Reviews Plus feature) — result
      // intentionally not destructured; best-effort, never blocks the lead.
      sendInquiryConfirmation({
        businessName: listing.name,
        businessEmail,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        message,
        serviceNeeded,
        urgency,
      }),
    ]);

    const emailOk =
      emailResult.status === "fulfilled" && emailResult.value.success;
    const smsOk =
      smsResult.status === "fulfilled" && smsResult.value.success;

    let deliveryStatus: string;
    if (emailOk && smsOk) deliveryStatus = "both_sent";
    else if (emailOk) deliveryStatus = "email_sent";
    else if (smsOk) deliveryStatus = "sms_sent";
    else deliveryStatus = "failed";

    // Insert lead record
    const { data: lead, error: insertErr } = await supabaseAdmin
      .from("leads_forwarded")
      .insert({
        listing_id: listingId,
        vertical: verticalConfig.tablePrefix.replace(/_$/, ""),
        business_name: listing.name,
        business_email: businessEmail,
        business_phone: businessPhone || null,
        visitor_name: name,
        visitor_email: email,
        visitor_phone: phone || null,
        message: message || null,
        service_needed: serviceNeeded || null,
        urgency,
        source_directory: verticalConfig.displayDomain,
        source_page: request.headers.get("referer") || null,
        visitor_ip: visitorIp,
        visitor_user_agent: visitorUserAgent,
        email_forwarded_at: emailOk ? new Date().toISOString() : null,
        sms_forwarded_at: smsOk ? new Date().toISOString() : null,
        delivery_status: deliveryStatus,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to insert lead:", insertErr.message);
    }

    return NextResponse.json({
      success: true,
      lead_id: lead?.id || null,
      delivery_status: deliveryStatus,
      forwarded: true,
    });
  }

  // ── FALLBACK PATH: store inquiry only (free/unclaimed) ─────────────
  await supabaseAdmin.from(INQUIRIES_TABLE).insert({
    listing_id: listing.id,
    name,
    email,
    phone: phone || null,
    message,
  });

  // Notify owner if they have email
  if (businessEmail) {
    await sendInquiryNotification(businessEmail, listing.name, {
      name,
      email,
      phone,
      message,
    }, listingSlug).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    forwarded: false,
  });
}
