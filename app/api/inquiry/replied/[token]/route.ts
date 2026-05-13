import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, INQUIRIES_TABLE, LISTINGS_TABLE } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MIN_RESPONSE_MINUTES = 5; // Anti-gaming: minimum delay
const MAX_TOKEN_AGE_DAYS = 14;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 30) {
    return renderResponse(
      "Invalid link",
      "This link appears to be invalid or malformed.",
      "error"
    );
  }

  const { data: foundInquiry, error: lookupError } = await supabaseAdmin
    .from(INQUIRIES_TABLE)
    .select("*")
    .eq("reply_token", token)
    .single();

  if (lookupError || !foundInquiry) {
    return renderResponse(
      "Link not found",
      "This link is invalid or has expired. If you replied to a consumer, your response is still valid — they received your email directly.",
      "error"
    );
  }

  if (foundInquiry.replied_at) {
    return renderResponse(
      "Already marked",
      `You marked this inquiry as replied on ${new Date(foundInquiry.replied_at).toLocaleString()}. No further action needed.`,
      "info"
    );
  }

  if (
    foundInquiry.reply_token_expires_at &&
    new Date(foundInquiry.reply_token_expires_at) < new Date()
  ) {
    return renderResponse(
      "Link expired",
      `This link has expired. Reply tracking links are valid for ${MAX_TOKEN_AGE_DAYS} days. Your actual reply to the consumer is still valid.`,
      "error"
    );
  }

  const inquiryCreatedAt = new Date(foundInquiry.created_at);
  const now = new Date();
  const minutesElapsed =
    (now.getTime() - inquiryCreatedAt.getTime()) / 1000 / 60;

  if (minutesElapsed < MIN_RESPONSE_MINUTES) {
    return renderResponse(
      "Too fast",
      `Please write your actual reply first, then come back and click this link. You've only been on this page for ${Math.floor(minutesElapsed)} minutes — real replies take longer than that. This protects the integrity of our response time rankings.`,
      "warning"
    );
  }

  const responseTimeMinutes = Math.round(minutesElapsed);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const { error: updateError } = await supabaseAdmin
    .from(INQUIRIES_TABLE)
    .update({
      replied_at: now.toISOString(),
      response_time_minutes: responseTimeMinutes,
      reply_clicked_from_ip: ip,
      reply_user_agent: userAgent,
    })
    .eq("reply_token", token);

  if (updateError) {
    console.error("Failed to update inquiry:", updateError);
    return renderResponse(
      "Error",
      "Something went wrong recording your reply. Please try again.",
      "error"
    );
  }

  // Bonus: confirming a reply is an owner action — stamp owner_last_action_at on the listing.
  // listing_id may be missing on legacy schemas (bp_inquiries uses operator_id).
  const linkedListingId =
    foundInquiry.listing_id ?? foundInquiry.operator_id ?? null;
  if (linkedListingId) {
    await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ owner_last_action_at: now.toISOString() })
      .eq("id", linkedListingId);
  }

  let humanTime: string;
  if (responseTimeMinutes < 60) {
    humanTime = `${responseTimeMinutes} minutes`;
  } else if (responseTimeMinutes < 1440) {
    humanTime = `${Math.round(responseTimeMinutes / 60)} hours`;
  } else {
    humanTime = `${Math.round(responseTimeMinutes / 1440)} days`;
  }

  return renderResponse(
    "✓ Reply confirmed",
    `Your response time of ${humanTime} has been recorded. Fast responses help you rank higher and earn the "Fast Responder" badge on your listing. Thanks for staying engaged!`,
    "success"
  );
}

function renderResponse(
  title: string,
  message: string,
  type: "success" | "error" | "info" | "warning"
): NextResponse {
  const colors = {
    success: { bg: "#f0fdf4", border: "#16a34a", accent: "#166534" },
    error: { bg: "#fef2f2", border: "#dc2626", accent: "#991b1b" },
    info: { bg: "#f0f9ff", border: "#2563eb", accent: "#1e40af" },
    warning: { bg: "#fefce8", border: "#ca8a04", accent: "#854d0e" },
  };

  const c = colors[type];

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; min-height: 100vh; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .badge { display: inline-block; padding: 6px 12px; background: ${c.bg}; color: ${c.accent}; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border-left: 4px solid ${c.border}; }
    h1 { margin: 0 0 12px 0; color: #0f172a; font-size: 24px; }
    p { color: #475569; line-height: 1.6; font-size: 16px; margin: 0 0 16px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">${type}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
