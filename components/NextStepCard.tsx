import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import type { NextStep } from "@/lib/owner-next-step";

// owner-next-step-card-canary-v1: exactly ONE action. Server-rendered; the dashboard's
// router.refresh() after a Google connect re-derives it.
const vc = verticalConfig as unknown as { primaryColor: string; ctaColor?: string };
const CTA_COLOR = vc.ctaColor || vc.primaryColor;

export default function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      data-next-step={step.kind}
      aria-labelledby="next-step-heading"
      className="border rounded-lg p-5 sm:p-6 border-l-4"
      style={{ borderLeftColor: verticalConfig.primaryColor }}
    >
      {/* owner-journey-friction-fix-v1: no eyebrow when the title already says it */}
      {!step.title.startsWith("Your next step") && (
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your next step</p>
      )}
      <h2 id="next-step-heading" className="text-lg sm:text-xl font-bold mt-1">{step.title}</h2>
      <p className="text-sm text-gray-600 mt-1">{step.body}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={step.cta.href}
          data-next-step-cta
          className="inline-block text-center px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
          style={{ backgroundColor: CTA_COLOR }}
        >
          {step.cta.label} →
        </Link>
        {step.guide && (
          <Link
            href={step.guide.href}
            data-next-step-guide
            className="text-sm font-medium underline text-center sm:text-left"
            style={{ color: verticalConfig.primaryColor }}
          >
            {step.guide.label}
          </Link>
        )}
      </div>
    </section>
  );
}
