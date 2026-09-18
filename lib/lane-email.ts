import verticalConfig from "@/lib/vertical.config";
import { LANE_BASE_URL } from "@/lib/lane-gate";

/**
 * THE LANE'S MAIL (spec §5.4).
 *
 * ── THE SENDERS ARE THE DIRECTORY'S OWN, AND THEY ARE NOT NEW ───────────────────────
 * DINLA is on the DIRECTORY pattern. The register plane's `REGISTRY_EMAIL_*` does not exist
 * in this repo and is never reached for. The two constants below are the SAME VALUES as
 * `lib/resend.ts:7` (`FROM_ADDRESS`) and `lib/resend.ts:11` (`AUTH_FROM`) — module
 * constants, not env vars, so there is no new sender, no new domain and no new env var.
 *
 * They are re-declared here rather than imported because `lib/resend.ts` does not export
 * them and the lane does not edit shared fleet files to get at a constant. `verify:lane-seam`
 * PS-L10 asserts the two files still agree, so the duplication cannot silently drift.
 *
 * ⚠️ The lane deliberately does NOT reuse `sendClaimEmail` / `sendMagicLink`. Their bodies
 * and links are the CLAIM FUNNEL's, and there must be exactly one code path in the estate
 * that can mint a claim credential. The lane mints none.
 */
export const LANE_FROM_ADDRESS = "notifications@smartwebsitemanagement.ca";
export const LANE_AUTH_FROM = `${verticalConfig.name} <verify@doineedanetwork.com>`;

export type LaneMailPurpose = "submission_verification" | "submission_live" | "submission_withdrawn";

export interface LaneMail {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly purpose: LaneMailPurpose;
}

export interface LaneMailResult {
  readonly accepted: boolean;
  readonly transport: string;
  readonly providerStatus: string;
}

/**
 * THE TRANSPORT SWITCH — and its refusal is the point of it.
 *
 * 🔴 `test` IS REFUSED IN PRODUCTION. A test sink that survives into production is a
 * proof-of-control BYPASS: the verify credential would be written to a log instead of a
 * mailbox, and anyone who can read that log can publish anyone. The refusal is a throw, not
 * a fallback — falling back to `resend` would mail a live person from a test run, and
 * falling back to `none` would silently stop verifying anybody.
 */
export type LaneTransport = "resend" | "test" | "none";

export function laneTransport(): LaneTransport {
  const raw = (process.env.LANE_MAIL_TRANSPORT ?? "resend").trim().toLowerCase();
  const isProd = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "").toLowerCase() === "production";
  if (raw === "test") {
    if (isProd) {
      throw new Error(
        "LANE_MAIL_TRANSPORT_TEST_REFUSED_IN_PRODUCTION: the test transport writes the verify " +
          "credential somewhere other than the submitter's mailbox, which turns proof-of-control " +
          "into a log read. It is refused in production rather than downgraded.",
      );
    }
    return "test";
  }
  if (raw === "none") return "none";
  return "resend";
}

/** The sink the `test` transport writes to. Never populated in production — see above. */
export const laneTestOutbox: LaneMail[] = [];

/**
 * Send. K36: **Resend RETURNS `{ data, error }`; it does not throw.** A try/catch around
 * `.send()` is not an error check, and that is exactly how a failed send becomes invisible.
 * The `{ error }` check is explicit and its result is what gets audited.
 *
 * The Resend client is constructed HERE rather than imported from `lib/resend.ts`, because
 * importing that module would pull the claim funnel's own senders into the lane's import
 * closure for no benefit.
 */
export async function sendLaneMail(mail: LaneMail): Promise<LaneMailResult> {
  const transport = laneTransport();
  if (transport === "none") return { accepted: false, transport, providerStatus: "transport_none" };
  if (transport === "test") {
    laneTestOutbox.push(mail);
    return { accepted: true, transport, providerStatus: "test_outbox" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    if (error) return { accepted: false, transport, providerStatus: error.message ?? "resend_error" };
    return { accepted: true, transport, providerStatus: data?.id ?? "" };
  } catch (e) {
    // A throw here is a transport fault (DNS, socket), not a rejection. Still not accepted.
    return { accepted: false, transport, providerStatus: e instanceof Error ? e.message : String(e) };
  }
}

const brand = verticalConfig.name;

/** The verify credential. The ONLY lane mail that carries a secret. */
export function verificationMail(to: string, businessName: string, token: string): LaneMail {
  // 🔴 THE LINK IS A PAGE, NOT A WRITER. `/submitted/verify` renders an interstitial and
  // writes nothing; the write happens on a POST a human clicks. This repo learned that the
  // hard way on its own claim route (`app/api/claim/verify/route.ts:8-34`): the mailed link
  // used to be a GET that wrote, and corporate link-safety rewriters and inbox previewers
  // completed claims on recipients' behalf.
  const link = `${LANE_BASE_URL}/submitted/verify?token=${encodeURIComponent(token)}`;
  return {
    to,
    from: LANE_AUTH_FROM,
    purpose: "submission_verification",
    subject: `Confirm your listing for ${businessName}`,
    text:
      `You asked to add ${businessName} to ${brand} as a self-submitted listing.\n\n` +
      `Open this link and confirm to publish it:\n${link}\n\n` +
      "The link is valid for 24 hours. Nothing is published until you confirm.\n\n" +
      "If you didn't request this, ignore this email — no listing will appear.",
    html:
      `<p>You asked to add <strong>${businessName}</strong> to ${brand} as a self-submitted listing.</p>` +
      `<p><a href="${link}">Open this link and confirm to publish it</a></p>` +
      `<p>Or copy this link: ${link}</p>` +
      "<p>The link is valid for 24 hours. Nothing is published until you confirm.</p>" +
      "<p style=\"color:#666;font-size:12px\">If you didn't request this, ignore this email — no listing will appear.</p>",
  };
}

export function liveMail(to: string, businessName: string, slug: string, ownerPath: string): LaneMail {
  const url = `${LANE_BASE_URL}/listed/${slug}`;
  return {
    to,
    from: LANE_FROM_ADDRESS,
    purpose: "submission_live",
    subject: `${businessName} is now listed on ${brand}`,
    text:
      `${businessName} is live at ${url}\n\n` +
      `Manage or remove it here: ${LANE_BASE_URL}${ownerPath}\n\n` +
      "This is a self-submitted listing. It is not indexed by search engines and shows no rating.",
    html:
      `<p><strong>${businessName}</strong> is live at <a href="${url}">${url}</a></p>` +
      `<p><a href="${LANE_BASE_URL}${ownerPath}">Manage or remove it here</a></p>` +
      "<p style=\"color:#666;font-size:12px\">This is a self-submitted listing. It is not indexed by " +
      "search engines and shows no rating.</p>",
  };
}

export function withdrawnMail(to: string, businessName: string): LaneMail {
  return {
    to,
    from: LANE_FROM_ADDRESS,
    purpose: "submission_withdrawn",
    subject: `${businessName} has been removed from ${brand}`,
    text:
      `${businessName} is no longer listed on ${brand}. The page now returns "not found" and ` +
      "your access link has been revoked.\n\nYou can submit it again at any time.",
    html:
      `<p><strong>${businessName}</strong> is no longer listed on ${brand}. The page now returns ` +
      "&ldquo;not found&rdquo; and your access link has been revoked.</p>" +
      "<p>You can submit it again at any time.</p>",
  };
}
