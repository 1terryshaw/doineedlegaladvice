// leads-plus-claim-continuity-v1 (GOAL 4): the confirmation an owner sees on return from a Leads Plus checkout
// (?upgrade=success&kit=1). Server component; the plan comes from the Stripe subscription (lib/plan-info), so a trial says
// when the first charge lands. Before the webhook has written the plan, it says so (UpgradeReturnRefresher reloads once).
import { formatTrialEnd, type PlanInfo } from "@/lib/plan-format";

export default function UpgradeSuccessNotice({ plan }: { plan: PlanInfo | null }) {
  const trial = plan?.status === "trialing" && plan.trialEnd;
  return (
    <div role="status" data-testid="upgrade-success" data-state={plan ? (trial ? "trial" : "paid") : "pending"} className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900">
      <p className="font-semibold">
        {!plan ? "Thank you — your Leads Plus checkout is complete" : trial ? "Trial started — Leads Plus is active" : "Payment received — Leads Plus is active"}
      </p>
      <p className="mt-1 text-sm">
        {!plan
          ? "We're switching your listing on now. This page updates in a moment."
          : trial
            ? `Your free 30-day trial is on. First charge on ${formatTrialEnd(plan.trialEnd)}. Cancel any time before then from Billing below.`
            : "Your lead form is live on your listing. Your receipt is on its way by e-mail."}
      </p>
    </div>
  );
}
