import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { verifyCron } from "@/lib/cron-auth";
import { Resend } from "resend";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_ADDRESS = "notifications@smartwebsitemanagement.ca";

export async function GET(request: NextRequest) {
  const authError = verifyCron(request);
  if (authError) return authError;

  const directoryName = verticalConfig.name;
  const domain = verticalConfig.domain;
  const displayDomain = verticalConfig.displayDomain;
  const vertical = verticalConfig.tablePrefix.replace(/_$/, "");

  // Get all paid-tier listings with owner email
  const { data: listings, error: listErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, name, owner_email, tier, subscription_tier")
    .in("tier", ["reviews_plus", "website", "growth"])
    .not("owner_email", "is", null);

  if (listErr || !listings || listings.length === 0) {
    return NextResponse.json({
      success: true,
      emails_sent: 0,
      listings_processed: 0,
      message: "No paid listings with owner email",
    });
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  let emailsSent = 0;

  for (const listing of listings) {
    const listingId = `${verticalConfig.tablePrefix}listings:${listing.id}`;

    const { count, error: countErr } = await supabaseAdmin
      .from("leads_forwarded")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .gte("created_at", sevenDaysAgo);

    if (countErr || count === null || count === 0) continue;

    // Count by urgency
    const { data: urgencyData } = await supabaseAdmin
      .from("leads_forwarded")
      .select("urgency")
      .eq("listing_id", listingId)
      .gte("created_at", sevenDaysAgo);

    const breakdown: Record<string, number> = {};
    for (const row of urgencyData || []) {
      const u = row.urgency || "flexible";
      breakdown[u] = (breakdown[u] || 0) + 1;
    }

    const breakdownLines = Object.entries(breakdown)
      .map(([u, n]) => `${u}: ${n}`)
      .join(" | ");

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Weekly Lead Report</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${directoryName} (${displayDomain})</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="font-size:15px;margin:0 0 16px;">Hi <strong>${listing.name}</strong>,</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px;">
      <div style="font-size:36px;font-weight:700;color:#16a34a;">${count}</div>
      <div style="font-size:14px;color:#15803d;">leads received this week</div>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">${breakdownLines}</p>
    <a href="https://${domain}/owner/login" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View your leads →</a>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">Sent by ${directoryName}. Manage your listing at https://${domain}/owner/login</p>
  </div>
</div>`;

    try {
      await getResend().emails.send({
        from: `${directoryName} <${FROM_ADDRESS}>`,
        to: listing.owner_email,
        subject: `${directoryName} — ${count} lead${count === 1 ? "" : "s"} this week`,
        html,
      });
      emailsSent++;
    } catch (err) {
      console.error(
        `Failed to send digest to ${listing.owner_email}:`,
        err
      );
    }
  }

  return NextResponse.json({
    success: true,
    emails_sent: emailsSent,
    listings_processed: listings.length,
  });
}
