import verticalConfig from "@/lib/vertical.config";
import {
  sendMagicLink as sendMagicLinkResend,
  sendClaimEmail as sendClaimEmailResend,
  type AuthSendResult,
} from "@/lib/resend";

// Auth transactional email (owner login + claim verification) migrated off Gmail
// SMTP to Resend (auth@smartwebsitemanagement.ca). These exports are thin delegates
// to lib/resend.ts so existing call sites keep importing from @/lib/email.
export async function sendMagicLink(
  email: string,
  slug: string,
  token: string
): Promise<AuthSendResult> {
  return sendMagicLinkResend(email, slug, token);
}

export async function sendClaimEmail(
  email: string,
  slug: string,
  token: string
): Promise<AuthSendResult> {
  return sendClaimEmailResend(email, slug, token);
}

export async function sendInquiryNotification(
  ownerEmail: string,
  listingName: string,
  inquiry: { name: string; email: string; phone?: string; message: string; replyToken?: string },
  listingSlug?: string
) {
  // TDL #455 smoke suppression: never dispatch real mail for test traffic.
  if (/tdl455canary/i.test(inquiry.email || "") || process.env.SMOKE_TEST === "1") {
    console.log(`[SMOKE] would-send: sendInquiryNotification -> ${ownerEmail} (suppressed)`);
    return;
  }
  // Inquiry forwards go via the system Resend sender, NEVER the personal Gmail account.
  // Reply-To is the visitor's own address so a reply goes straight to the customer, not us.
  // ONE canonical host for every link in this email (resolves the apex/www split).
  const host = verticalConfig.domain;
  const listingUrl = listingSlug
    ? `https://${host}/directory/${listingSlug}`
    : `https://${host}`;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${verticalConfig.name} <notifications@smartwebsitemanagement.ca>`,
    to: ownerEmail,
    replyTo: inquiry.email,
    subject: `New inquiry for ${listingName} on ${verticalConfig.name}`,
    html: `
        <h2>New Inquiry for ${listingName}</h2>
        <p><strong>From:</strong> ${inquiry.name} (${inquiry.email}${inquiry.phone ? `, ${inquiry.phone}` : ""})</p>
        <p><strong>Message:</strong></p>
        <p>${inquiry.message}</p>
        ${inquiry.replyToken ? `
        <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #1e40af;">
            <strong>⚡ New: Track your response time</strong>
          </p>
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569;">
            After you reply to this inquiry, click the link below. Pros who respond quickly get a "Fast Responder" badge on their listing and rank higher in search results.
          </p>
          <a href="https://${host}/api/inquiry/replied/${inquiry.replyToken}"
             style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
            Mark as Replied →
          </a>
        </div>` : ""}
        <hr />
        <p style="font-size:13px;color:#374151;margin:0 0 8px;line-height:1.5;">
          You're receiving this because <strong>${listingName}</strong> is listed on ${verticalConfig.name}.
          <a href="${listingUrl}" style="color:#2563eb;text-decoration:underline;">View your listing →</a>
        </p>
        <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.5;">
          Sent by Smart Website Management, operator of ${verticalConfig.name} (${host}), because your business is listed in our public directory.
        </p>
      `,
  });
  if (error) {
    console.error("sendInquiryNotification (resend) failed:", error);
    throw new Error(error.message);
  }
}
