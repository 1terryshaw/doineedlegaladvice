// leads-plus-canary-v1 P5 — one static page per owner routing guide (noindex,follow via guideMetadata;
// never in the sitemap — same pattern as the existing owner guides).
import { notFound } from "next/navigation";
import GuideShell, { guideMetadata } from "@/components/guides/GuideShell";
import { ROUTING_GUIDES } from "@/lib/lead-routing-guides";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ROUTING_GUIDES.map((g) => ({ topic: g.slug }));
}

export function generateMetadata({ params }: { params: { topic: string } }) {
  const g = ROUTING_GUIDES.find((x) => x.slug === params.topic);
  return g ? guideMetadata(`/guides/leads/${g.slug}`, g.title, g.description) : {};
}

export default function LeadRoutingGuide({ params }: { params: { topic: string } }) {
  const g = ROUTING_GUIDES.find((x) => x.slug === params.topic);
  if (!g) notFound();
  return (
    <GuideShell title={g.title} subtitle={g.subtitle}>
      {g.body}
      <p className="mt-8 text-sm"><a className="underline" href="/guides/leads">← All inquiry routing guides</a></p>
    </GuideShell>
  );
}
