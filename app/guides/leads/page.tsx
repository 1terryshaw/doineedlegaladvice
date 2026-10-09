// leads-plus-canary-v1 P5 — index of the owner inquiry-routing guides.
import GuideShell, { H2, guideMetadata } from "@/components/guides/GuideShell";
import { ROUTING_GUIDES } from "@/lib/lead-routing-guides";

export const dynamic = "force-static";

export const metadata = guideMetadata(
  "/guides/leads",
  "Route your new inquiries anywhere",
  "Free guides for business owners: get every “New inquiry” email as a phone alert, a text, a WhatsApp message, to your staff, or into a spreadsheet.",
);

export default function LeadRoutingIndex() {
  return (
    <GuideShell title="Route your new inquiries anywhere" subtitle="Free guides for business owners">
      <p className="mt-6">
        Every inquiry from your listing arrives by email with a subject that starts <code className="bg-gray-100 px-1 rounded">New inquiry</code>.
        That one fixed line is all these guides need. Pick how you want to hear about new customers:
      </p>
      <H2>Guides</H2>
      <ul className="space-y-3">
        {ROUTING_GUIDES.map((g, i) => (
          <li key={g.slug}>
            <a className="font-medium underline" href={`/guides/leads/${g.slug}`}>{i + 1}. {g.title}</a>
            <p className="text-sm text-gray-600">{g.subtitle}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">Every tool mentioned is your own account on its free tier — we never hold or see it.</p>
    </GuideShell>
  );
}
