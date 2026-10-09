// leads-plus-canary-v1 P5 — owner routing guides. Every guide starts from the one fixed thing we
// control: each Leads Plus inquiry arrives as an email whose subject starts "New inquiry".
// Free tiers only; every third-party tool is the OWNER's own account (we never hold it).
import type { ReactNode } from "react";
import { H2 } from "@/components/guides/GuideShell";

export type RoutingGuide = { slug: string; title: string; subtitle: string; description: string; body: ReactNode };

const Subject = () => <code className="bg-gray-100 px-1 rounded">New inquiry</code>;
const Own = () => (
  <p className="mt-6 text-sm bg-gray-50 border rounded p-3">
    The tools below are <strong>your own accounts</strong>, set up and controlled by you. We don&apos;t see, run or
    pay for them. Every step uses the tool&apos;s free tier — if a tool asks you to upgrade, you don&apos;t need to for this.
  </p>
);
const Start = () => (
  <>
    <H2>What you start from</H2>
    <p>
      Every inquiry from your listing is emailed to the address you log in with. The subject always starts with <Subject />,
      followed by the service and the customer&apos;s first name — for example “New inquiry: Panel upgrade — Maria”.
      Replying to that email replies to the customer.
    </p>
  </>
);
const ol = "list-decimal pl-6 space-y-2 mt-2";

export const ROUTING_GUIDES: RoutingGuide[] = [
  {
    slug: "phone-alert",
    title: "Get a phone alert for every new inquiry",
    subtitle: "Gmail or Outlook — free, about 5 minutes",
    description: "Make every “New inquiry” email ring through on your phone with Gmail or Outlook, using a VIP, label or rule.",
    body: (
      <>
        <Start />
        <H2>Gmail (Android or iPhone)</H2>
        <ol className={ol}>
          <li>On a computer, open Gmail, type <Subject /> in the search bar, then click the filter icon at the right of the search bar.</li>
          <li>In <em>Subject</em>, enter <Subject />. Click <em>Create filter</em>.</li>
          <li>Tick <em>Apply the label</em> → <em>New label</em> → name it <strong>Leads</strong>. Also tick <em>Never send it to Spam</em>. Click <em>Create filter</em>.</li>
          <li>On your phone: Gmail app → Settings → your account → <em>Manage labels</em> → <strong>Leads</strong> → turn on <em>Label notifications</em> and <em>Notify for every message</em>, and pick a distinct sound.</li>
        </ol>
        <H2>Outlook</H2>
        <ol className={ol}>
          <li>Outlook on the web → Settings → Mail → <em>Rules</em> → <em>Add new rule</em>.</li>
          <li>Condition: <em>Subject includes</em> <Subject />. Action: <em>Mark as Important</em> and <em>Move to</em> a folder named <strong>Leads</strong>.</li>
          <li>Outlook mobile app → Settings → Notifications → set the <strong>Leads</strong> folder (or Focused Inbox) to notify.</li>
          <li>iPhone Mail users: add the sender to VIP (open a lead email → tap the sender → <em>Add to VIP</em>), then Settings → Notifications → Mail → VIP.</li>
        </ol>
        <Own />
      </>
    ),
  },
  {
    slug: "text-message",
    title: "Get new inquiries as a text message",
    subtitle: "Email filter forwarding or a phone automation — free",
    description: "Forward “New inquiry” emails to your phone as a text, using a mail filter or a free phone automation.",
    body: (
      <>
        <Start />
        <H2>Option 1 — Android: a free automation app</H2>
        <ol className={ol}>
          <li>Install a notification-forwarding automation app you trust that has a free tier (for example, an app that can forward a notification as SMS).</li>
          <li>Create a rule: when a notification from your mail app contains <Subject />, send an SMS to your number (or a co-worker&apos;s).</li>
          <li>Send yourself a test lead from your dashboard to check it fires.</li>
        </ol>
        <H2>Option 2 — iPhone: Shortcuts</H2>
        <ol className={ol}>
          <li>Open <em>Shortcuts</em> → <em>Automation</em> → <em>New automation</em> → <em>Email</em>.</li>
          <li>Subject contains <Subject /> → <em>Run immediately</em>.</li>
          <li>Action: <em>Send Message</em> to the person who should get it. (Some iOS versions only notify you to tap “Run” — that&apos;s an Apple limit.)</li>
        </ol>
        <H2>Option 3 — your mobile carrier&apos;s email-to-text address</H2>
        <p>
          Many carriers give each phone an email address that arrives as a text (check your carrier&apos;s help pages).
          In Gmail or Outlook, add a filter for subject <Subject /> that <em>forwards</em> to that address. Gmail will ask you
          to confirm the forwarding address once.
        </p>
        <Own />
      </>
    ),
  },
  {
    slug: "whatsapp",
    title: "Send new inquiries to WhatsApp",
    subtitle: "Zapier or Make — free tier",
    description: "Push each “New inquiry” email into WhatsApp with a free Zapier or Make scenario.",
    body: (
      <>
        <Start />
        <H2>With Zapier (free plan)</H2>
        <ol className={ol}>
          <li>Create a free Zapier account. New Zap → Trigger: <em>Gmail — New Email Matching Search</em> (or <em>Microsoft Outlook — New Email</em>), search <code className="bg-gray-100 px-1 rounded">subject:&quot;New inquiry&quot;</code>.</li>
          <li>Action: a WhatsApp app available on your plan (for example WhatsApp Notifications or a WhatsApp Business integration). Map the email subject and body into the message.</li>
          <li>Turn the Zap on and send yourself a test lead from your dashboard.</li>
        </ol>
        <H2>With Make (free plan)</H2>
        <ol className={ol}>
          <li>New scenario → <em>Gmail: Watch emails</em> (or Outlook) with the filter subject contains <Subject />.</li>
          <li>Add a WhatsApp Business Cloud module (needs a WhatsApp Business account you own) → <em>Send a message</em>.</li>
          <li>Schedule it every 15 minutes (the free plan&apos;s operations go a long way for a few leads a day).</li>
        </ol>
        <p className="mt-3">Prefer customers to message you directly? Add your WhatsApp number in your dashboard and a WhatsApp button appears on your page.</p>
        <Own />
      </>
    ),
  },
  {
    slug: "send-to-staff",
    title: "Send new inquiries to your staff",
    subtitle: "A second address or a forwarding rule — free",
    description: "Make sure the right person sees every inquiry: add a second notification address or forward “New inquiry” emails.",
    body: (
      <>
        <Start />
        <H2>Easiest — add a second notification address</H2>
        <p>In your dashboard, under <em>Where inquiries go</em>, add one more email address (an office manager, a shared inbox). Both get every inquiry.</p>
        <H2>More people — a forwarding rule</H2>
        <ol className={ol}>
          <li>Gmail: create a filter for subject <Subject /> → <em>Forward it to</em> a teammate (confirm the address once). Outlook: a rule for subject <Subject /> → <em>Forward to</em>.</li>
          <li>Several people? Forward to a free group address (for example a Google Group) so you can add and remove staff without touching the rule.</li>
          <li>Agree who replies, then set the lead to <em>Replied</em> in your leads inbox so nobody answers twice.</li>
        </ol>
        <Own />
      </>
    ),
  },
  {
    slug: "spreadsheet",
    title: "Log new inquiries in a spreadsheet",
    subtitle: "Google Sheets with a free script or Zapier/Make",
    description: "Keep a running sheet of every “New inquiry” email in Google Sheets, free.",
    body: (
      <>
        <Start />
        <H2>Option 1 — Google Sheets + Apps Script (free, Gmail)</H2>
        <ol className={ol}>
          <li>Create a Google Sheet with columns Date, Subject, From, Body. Extensions → <em>Apps Script</em>.</li>
          <li>
            Paste this and save:
            <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto mt-2">{`function logLeads() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const label = GmailApp.getUserLabelByName('Leads-logged') || GmailApp.createLabel('Leads-logged');
  GmailApp.search('subject:"New inquiry" -label:Leads-logged', 0, 50).forEach(t => {
    t.getMessages().forEach(m => sheet.appendRow([m.getDate(), m.getSubject(), m.getReplyTo() || m.getFrom(), m.getPlainBody()]));
    t.addLabel(label);
  });
}`}</pre>
          </li>
          <li>Triggers (clock icon) → <em>Add trigger</em> → <code>logLeads</code>, time-driven, every 15 minutes. Approve the permission prompt (it&apos;s your own script on your own account).</li>
        </ol>
        <H2>Option 2 — Zapier or Make</H2>
        <p>Trigger on a new email with subject <Subject />, action <em>Google Sheets — Create Spreadsheet Row</em>. Both have free plans that cover a few leads a day.</p>
        <p className="mt-3">Your dashboard&apos;s leads inbox already keeps every inquiry for 12 months, with status New / Replied / Closed.</p>
        <Own />
      </>
    ),
  },
];
