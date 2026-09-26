import GuideShell, { H2, guideMetadata } from "@/components/guides/GuideShell";

export const dynamic = "force-static";

export const metadata = guideMetadata(
  "/guides/monthly-checkup",
  "Your 10-minute monthly check-up",
  "A free one-page guide for business owners: five things to check once a month so customers can find you and pick you.",
);

export default function MonthlyCheckupGuide() {
  return (
    <GuideShell title="Your 10-minute monthly check-up" subtitle="A free one-page guide for business owners">
      <H2>How customers find you, and why they pick you</H2>
      <p>
        Customers find you when your information is complete, accurate and consistent everywhere: your listing with
        us, Google, and your website. They pick you when they see recent reviews, real photos and an owner who clearly
        pays attention. Nobody can promise you a top spot. But businesses that keep these basics fresh give themselves
        the best chance.
      </p>

      <H2>Once a month, check:</H2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>Hours. Still right? Any holidays coming up?</li>
        <li>Photos. Add one or two new ones: recent work, your team, your space.</li>
        <li>Reviews. Reply to any new ones, and ask your happy customers from this month.</li>
        <li>Key information. Phone, website, address and services, the same on Google and on your listing with us.</li>
        <li>One improvement. Pick a single thing to make better: a sharper description, a missing service, a better photo.</li>
      </ol>
    </GuideShell>
  );
}
