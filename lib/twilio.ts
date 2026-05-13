import verticalConfig from "@/lib/vertical.config";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

const CONFIGURED = !!(ACCOUNT_SID && AUTH_TOKEN && FROM_NUMBER);

export async function sendLeadForwardSMS(
  toPhone: string,
  visitorName: string,
  businessName: string
): Promise<{ success: boolean; error?: string }> {
  if (!CONFIGURED) {
    return { success: false, error: "twilio_not_configured" };
  }

  const directoryName = verticalConfig.name;
  const body = `New lead via ${directoryName}: ${visitorName} needs your help. Check your email for full details. - ${directoryName}`.slice(
    0,
    160
  );

  try {
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
    const params = new URLSearchParams({
      To: toPhone,
      From: FROM_NUMBER!,
      Body: body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Twilio error:", err);
      return { success: false, error: `twilio_${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Twilio exception:", err);
    return { success: false, error: err.message };
  }
}
