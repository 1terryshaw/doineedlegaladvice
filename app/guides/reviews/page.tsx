// owner-journey-friction-fix-v1: ruling 4.
import GuideShell, { ConnectLink, H2, H3, guideMetadata } from "@/components/guides/GuideShell";

export const dynamic = "force-static";

export const metadata = guideMetadata(
  "/guides/reviews",
  "Reviews: why they matter, how to get more, and how to reply",
  "A free guide for business owners: why reviews matter, how to get more of them the right way, what never to do, and how to reply to good and bad reviews.",
);

const quote = "border-l-4 border-gray-200 pl-4 italic text-gray-700";

export default function ReviewsGuide() {
  return (
    <GuideShell
      title="Reviews: why they matter, how to get more, and how to reply"
      subtitle="A free guide for business owners"
    >
      <H2>Why reviews matter</H2>
      <p>
        When someone finds your business, reviews are usually what decides whether they call you or the next name on
        the list. Five things count:
      </p>
      <ul className="list-disc pl-6 space-y-1 mt-2">
        <li>Trust. Real customers vouching for you beat anything you can say about yourself.</li>
        <li>Volume. Ten reviews feels safer than two, even at the same rating.</li>
        <li>
          Recency. A steady trickle of recent reviews says you&apos;re active and still good. A great review from
          years ago says less.
        </li>
        <li>Rating. It matters, but a 4.7 with honest variety often looks more believable than a perfect 5.0.</li>
        <li>Your replies. People read how you respond, especially to the unhappy ones.</li>
      </ul>
      <p className="mt-3">
        Reviews help you get chosen. They can also help you get found, but nobody can promise a ranking, and you
        should be wary of anyone who does.
      </p>

      <H2>How to get more reviews, the right way</H2>
      <p>
        Ask real customers. The best moment is right after a job goes well: a thank-you, a finished project, a happy
        customer at the counter.
      </p>
      <p className="mt-3">
        Make it one tap. Send people straight to your review form with your direct Google review link. Print the QR
        code for your counter, invoices, business cards or truck.
      </p>
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm" data-review-kit>
        Owners: your personal review link and QR code are on <ConnectLink />. Not connected to Google yet? Connect it
        there first.
      </div>
      <p className="mt-4">Keep the ask short and human. For example:</p>
      <ul className="list-disc pl-6 space-y-2 mt-2">
        <li>
          In person: &quot;Really glad this worked out. If you have a minute, a Google review helps us a lot.
          Here&apos;s the link.&quot;
        </li>
        <li>
          By text: &quot;Thanks again, {"{first_name}"}! If you were happy with our work, would you leave us a quick
          Google review? {"{review_link}"}&quot;
        </li>
        <li>
          By email: &quot;Thank you for choosing us. If you have a moment, a short review helps other people find us:{" "}
          {"{review_link}"}. Either way, we appreciate your business.&quot;
        </li>
      </ul>
      <p className="mt-3">
        Make it a habit, not a campaign. Ask every happy customer as part of how you finish a job. A few reviews a
        month beats a burst once a year.
      </p>

      <H2>What never to do</H2>
      <p>These break Google&apos;s rules and can get reviews removed or your profile penalized:</p>
      <ul className="list-disc pl-6 space-y-1 mt-2">
        <li>
          Ask only happy customers to review, or screen people first (&quot;Were you satisfied? If yes, review
          us&quot;). That&apos;s called gating.
        </li>
        <li>Offer discounts, gifts or entries in exchange for reviews.</li>
        <li>Review your own business, or have staff, family or friends do it.</li>
        <li>Buy reviews or use review-swap groups.</li>
      </ul>

      <H2>How to reply to reviews</H2>
      <p>Reply to every review you can, good and bad. Keep it short, personal and calm.</p>
      <H3>A positive review:</H3>
      <p className={quote}>
        &quot;Thank you, {"{name}"}! We really enjoyed working on your {"{job}"}. Glad it turned out well, and
        we&apos;re here whenever you need us.&quot;
      </p>
      <H3>A mixed review:</H3>
      <p className={quote}>
        &quot;Thanks for the honest feedback, {"{name}"}. Glad the {"{good part}"} worked for you, and sorry{" "}
        {"{issue}"} wasn&apos;t what you expected. We&apos;d like to make it right. Please call us at {"{phone}"}.&quot;
      </p>
      <H3>A negative review:</H3>
      <p className={quote}>
        &quot;We&apos;re sorry to hear this, {"{name}"}. This isn&apos;t the experience we want anyone to have. Please
        contact us directly at {"{phone}"} or {"{email}"} so we can understand what happened and try to fix it.&quot;
      </p>
      <H3>Rules for hard replies:</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>Don&apos;t argue, and don&apos;t reply while angry.</li>
        <li>
          Never share a customer&apos;s personal details, or confirm they were a client. This matters especially for
          health, legal and financial businesses.
        </li>
        <li>Take the conversation offline.</li>
        <li>If a review is fake or breaks Google&apos;s rules, you can report it from your Google Business Profile.</li>
      </ul>

      <H2>Your 5-minute review habit</H2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Ask every happy customer.</li>
        <li>Check for new reviews.</li>
        <li>Reply to each one.</li>
        <li>Notice what people praise, and what they don&apos;t.</li>
      </ol>
    </GuideShell>
  );
}
