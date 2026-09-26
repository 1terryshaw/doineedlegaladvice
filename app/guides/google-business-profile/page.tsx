import GuideShell, { ConnectLink, H2, guideMetadata } from "@/components/guides/GuideShell";
import { contactHref } from "@/lib/contact-link";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-static";

export const metadata = guideMetadata(
  "/guides/google-business-profile",
  "Your Google Business Profile: connect it, fix it, keep it fresh",
  "A free guide for business owners: connect your Google Business Profile to your listing, make it complete and accurate, add real photos and keep it current.",
);

export default function GoogleBusinessProfileGuide() {
  return (
    <GuideShell
      title="Your Google Business Profile: connect it, fix it, keep it fresh"
      subtitle="A free guide for business owners"
    >
      <H2>Why it matters</H2>
      <p>
        Your Google Business Profile is the box that shows up when someone searches your business name or looks on
        Google Maps. For many customers it&apos;s the first thing they see: your hours, phone number, directions,
        photos and reviews, all in one place. If it&apos;s wrong or missing, you lose people before they ever reach
        your website.
      </p>

      <H2>Step 1: Connect it to your listing</H2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Open Google Maps and search your business name.</li>
        <li>Click your business, then tap Share, then Copy link.</li>
        <li>
          On your dashboard, click Connect Google and paste the link: <ConnectLink />
        </li>
      </ol>
      <p className="mt-3">
        Once we can read your Google reviews, your listing shows the Reviews verified badge and your Google rating, and
        you unlock your personal review link and QR code.
      </p>

      <H2>Step 2: Make it complete and accurate</H2>
      <p>Sign in at business.google.com and check each item:</p>
      <ul className="list-disc pl-6 space-y-1 mt-2">
        <li>
          Categories: pick the most specific primary category that fits what you actually do, then add a few true
          secondary ones.
        </li>
        <li>Services: list the main things people hire you for, in the words customers use.</li>
        <li>Description: two or three plain sentences. Say who you help, what you do and where. No keyword stuffing.</li>
        <li>
          Hours: regular hours plus holiday hours. Wrong hours are one of the fastest ways to lose a customer&apos;s
          trust.
        </li>
        <li>Contact: phone, website and address match your listing with us, word for word where possible.</li>
        <li>
          Service area: if you go to customers rather than them coming to you, set your service area. You can hide
          your street address.
        </li>
      </ul>

      <H2>Step 3: Add real photos</H2>
      <p>
        Show your real storefront, team, workspace and finished work. Skip stock images. Add a few new ones every so
        often; a profile with recent photos looks alive.
      </p>

      <H2>Step 4: Keep it current</H2>
      <p>
        Whenever something changes (hours, phone number, services, a move), update Google and your listing with us
        together. Five minutes of upkeep saves you from customers showing up to a locked door.
      </p>

      <H2>If Google can&apos;t find your business</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Your business isn&apos;t on Google Maps at all: create a profile at business.google.com and follow the
          verification steps Google offers you.
        </li>
        <li>
          It&apos;s there, but nobody has claimed it: open it on Google Maps and choose the option to claim it. Google
          will walk you through verification.
        </li>
        <li>
          Someone else controls it (a former employee, an old agency, a previous owner): use the Request access option
          Google shows on the profile. If they don&apos;t respond, Google will tell you what you can do next.
        </li>
        <li>
          Stuck on verification: Google may offer a call, text, email, video or postcard, depending on your business.
          Use whichever it offers, and don&apos;t create a second profile while you wait. Duplicates cause problems.
        </li>
        <li>
          Still stuck?{" "}
          <a
            href={contactHref() ?? undefined}
            data-guide-contact
            className="font-medium underline"
            style={{ color: verticalConfig.primaryColor }}
          >
            Contact us
          </a>{" "}
          and tell us what you&apos;re seeing.
        </li>
      </ul>
    </GuideShell>
  );
}
