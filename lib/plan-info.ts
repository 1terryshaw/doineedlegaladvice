// leads-plus-canary-v1 (dashboard fix): the owner's REAL plan name + charge, read from the Stripe subscription —
// never inferred from the tier slug (a $19 Leads Plus sub and a legacy $9 Reviews Plus sub share `reviews_plus`).
// Server-only. Fail-soft: any Stripe error ⇒ null ⇒ the dashboard falls back to its tier label.
import { stripe } from "@/lib/stripe";
import type { PlanInfo } from "@/lib/plan-format";
export { formatCharge, formatTrialEnd, type PlanInfo } from "@/lib/plan-format";

const LEADS_PLUS_PRICES = new Set(["price_1UObHCB4nhVx1nmU7yb9XJkY"]);
// Every Reviews Plus / Lead Boost generation (all now grant Leads Plus — migration rule).
const LEGACY_RP_PRICES = new Set([
  "price_1TK3tkB4nhVx1nmUb3PuMFVo", "price_1TK5vkB4nhVx1nmUYFofmHXK", // Gen 1 CAD
  "price_1TLq8uB4nhVx1nmU6ePVSahq", "price_1TLq8RB4nhVx1nmUVF07t9dv", // Gen 2 CAD
  "price_1TS1zCB4nhVx1nmUuui9Ix1P", "price_1TS1zEB4nhVx1nmUjnNscPVN", // Gen 3 CAD Leads Boost
  "price_1TWCWhB4nhVx1nmU7e5wn3EI", "price_1TWCWhB4nhVx1nmU9rAwLlH0", // Gen 6 USD $9 / $90
]);

export function planName(priceId: string, productName?: string | null, metadataPlan?: string | null): string {
  if (LEADS_PLUS_PRICES.has(priceId) || metadataPlan === "leads_plus") return "Leads Plus";
  if (LEGACY_RP_PRICES.has(priceId)) return "Leads Plus (Reviews Plus legacy)";
  return productName || "Paid plan";
}

export async function getPlanInfo(subscriptionId: string | null | undefined): Promise<PlanInfo | null> {
  if (!subscriptionId || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product", "latest_invoice.charge"],
    });
    if (!["active", "trialing", "past_due"].includes(sub.status)) return null;
    const price = sub.items.data[0]?.price;
    if (!price) return null;
    const product = typeof price.product === "object" && price.product && "name" in price.product ? (price.product.name as string) : null;
    // What the owner is actually CHARGED: the latest charge's currency/amount when it differs from the price
    // (e.g. a CAD-priced legacy sub); otherwise the price itself.
    const inv = sub.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const charge = inv && typeof (inv as { charge?: unknown }).charge === "object" ? (inv as { charge: { amount: number; currency: string } | null }).charge : null;
    const useCharge = !!charge && charge.currency !== price.currency && charge.amount > 0;
    return {
      name: planName(price.id, product, sub.metadata?.plan ?? null),
      amount: useCharge ? charge!.amount : price.unit_amount ?? 0,
      currency: useCharge ? charge!.currency : price.currency,
      interval: price.recurring?.interval ?? "month",
      status: sub.status,
      trialEnd: sub.status === "trialing" && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    };
  } catch (e) {
    console.error("[plan-info] stripe read failed:", (e as Error).message);
    return null;
  }
}
