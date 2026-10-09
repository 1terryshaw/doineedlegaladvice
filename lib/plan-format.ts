// leads-plus-canary-v1 fixup-2: CLIENT-SAFE plan types + formatting. No Stripe import here — lib/plan-info.ts (server)
// imports lib/stripe, and pulling it into a client component crashed every owner dashboard at hydration.
// trialEnd: ISO date the free trial ends (status "trialing"), else null — the owner sees "free trial until <date>".
export type PlanInfo = { name: string; amount: number; currency: string; interval: string; status: string; trialEnd?: string | null };

export function formatTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatCharge(p: Pick<PlanInfo, "amount" | "currency" | "interval">): string {
  const n = p.amount / 100;
  const amt = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `$${amt} ${p.currency.toUpperCase()}/${p.interval === "year" ? "yr" : "mo"}`;
}
