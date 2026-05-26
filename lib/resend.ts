import { Resend } from "resend";
import verticalConfig from "@/lib/vertical.config";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_ADDRESS = "notifications@smartwebsitemanagement.ca";

interface LeadEmailData {
  businessName: string;
  businessEmail: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  message?: string;
  serviceNeeded?: string;
  urgency?: string;
  sourcePage?: string;
}

export async function sendLeadForwardEmail(
  data: LeadEmailData
): Promise<{ success: boolean; error?: string }> {
  const directoryName = verticalConfig.name;
  const domain = verticalConfig.domain;
  const displayDomain = verticalConfig.displayDomain;

  const urgencyBadge =
    data.urgency === "emergency"
      ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">EMERGENCY</span>'
      : data.urgency === "urgent"
        ? '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">URGENT</span>'
        : '<span style="background:#6b7280;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Flexible</span>';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">New Lead from ${directoryName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${displayDomain}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${data.businessName}</strong>, you have a new lead!</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top;">Name</td>
        <td style="padding:8px 0;font-weight:600;">${data.visitorName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${data.visitorEmail}" style="color:${verticalConfig.primaryColor};">${data.visitorEmail}</a></td>
      </tr>
      ${data.visitorPhone ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Phone</td><td style="padding:8px 0;"><a href="tel:${data.visitorPhone}" style="color:${verticalConfig.primaryColor};">${data.visitorPhone}</a></td></tr>` : ""}
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Urgency</td>
        <td style="padding:8px 0;">${urgencyBadge}</td>
      </tr>
      ${data.serviceNeeded ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Service</td><td style="padding:8px 0;">${data.serviceNeeded}</td></tr>` : ""}
    </table>

    ${data.message ? `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${verticalConfig.primaryColor};border-radius:4px;font-size:14px;line-height:1.5;">${data.message}</div>` : ""}

    <div style="margin-top:20px;">
      <a href="mailto:${data.visitorEmail}?subject=Re: Your inquiry on ${directoryName}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reply to ${data.visitorName} →</a>
    </div>

    ${data.visitorPhone ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Or call directly: <a href="tel:${data.visitorPhone}" style="color:${verticalConfig.primaryColor};font-weight:600;">${data.visitorPhone}</a></p>` : ""}

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">This lead was sent through ${directoryName} (${displayDomain}). Manage your listing at https://${domain}/owner/login</p>
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({
      from: `${directoryName} <${FROM_ADDRESS}>`,
      to: data.businessEmail,
      replyTo: data.visitorEmail,
      subject: `🔔 New lead from ${directoryName} — ${data.visitorName}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Resend exception:", err);
    return { success: false, error: err.message };
  }
}


/**
 * Branded confirmation email sent to the prospect (visitor) after they submit
 * an inquiry on a Reviews Plus listing. Reassures them the inquiry reached the
 * business and carries the directory's name + styling.
 */
export async function sendInquiryConfirmation(
  data: LeadEmailData
): Promise<{ success: boolean; error?: string }> {
  const directoryName = verticalConfig.name;
  const displayDomain = verticalConfig.displayDomain;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">${directoryName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${displayDomain}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${data.visitorName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">Thanks for reaching out through ${directoryName}. Your inquiry has been sent to <strong>${data.businessName}</strong> — they'll be in touch with you directly.</p>

    <div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${verticalConfig.primaryColor};border-radius:4px;font-size:14px;line-height:1.5;">
      <p style="margin:0 0 8px;font-weight:600;color:#374151;">What you sent</p>
      ${data.serviceNeeded ? `<p style="margin:0 0 4px;"><span style="color:#6b7280;">Service:</span> ${data.serviceNeeded}</p>` : ""}
      ${data.message ? `<p style="margin:0;"><span style="color:#6b7280;">Message:</span> ${data.message}</p>` : ""}
    </div>

    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">If you don't hear back soon, just reply to this email and we'll follow up.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">Sent via ${directoryName} (${displayDomain}). You received this because you submitted an inquiry on our directory.</p>
  </div>
</div>`;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${directoryName} <${FROM_ADDRESS}>`,
      to: data.visitorEmail,
      ...(data.businessEmail ? { replyTo: data.businessEmail } : {}),
      subject: `Your inquiry to ${data.businessName} has been sent`,
      html,
    });

    if (error) {
      console.error("Resend error (inquiry confirmation):", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Resend exception (inquiry confirmation):", err);
    return { success: false, error: err.message };
  }
}
