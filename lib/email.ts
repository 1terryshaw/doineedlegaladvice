import nodemailer from "nodemailer";
import verticalConfig from "@/lib/vertical.config";

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function getFromAddress() {
  return `"${verticalConfig.name}" <${process.env.GMAIL_USER}>`;
}

export async function sendMagicLink(email: string, slug: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const magicLink = `${baseUrl}/api/owner/auth?token=${token}&slug=${slug}`;

  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject: `Your login link for ${verticalConfig.name}`,
      html: `
        <h2>Welcome back to ${verticalConfig.name}</h2>
        <p>Click the link below to access your listing dashboard:</p>
        <p><a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:white;text-decoration:none;border-radius:6px;">Access Dashboard</a></p>
        <p>Or copy this link: ${magicLink}</p>
        <p>This link will log you in and is valid for 30 days.</p>
        <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("sendMagicLink failed:", err);
    throw err;
  }
}

export async function sendClaimEmail(email: string, slug: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/claim/verify?token=${token}&slug=${slug}`;

  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject: `Verify your claim on ${verticalConfig.name}`,
      html: `
        <h2>Claim Your Listing on ${verticalConfig.name}</h2>
        <p>Click the link below to verify your ownership claim:</p>
        <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:white;text-decoration:none;border-radius:6px;">Verify Claim</a></p>
        <p>Or copy this link: ${verifyLink}</p>
        <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("sendClaimEmail failed:", err);
    throw err;
  }
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
