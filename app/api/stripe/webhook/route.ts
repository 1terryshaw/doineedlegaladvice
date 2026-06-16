import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getTierByPriceId } from "@/lib/pricing-canonical";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const listingSlug = session.metadata?.listingSlug;
      if (listingSlug && session.subscription && session.customer) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price?.id;
        const matchedTier = priceId ? getTierByPriceId(priceId) : null;
        await supabaseAdmin
          .from(LISTINGS_TABLE)
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            tier: matchedTier?.id || "claimed",
            subscription_tier: matchedTier?.id || "free",
            updated_at: new Date().toISOString(),
          })
          .eq("slug", listingSlug);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId ? getTierByPriceId(priceId) : null;
      await supabaseAdmin
        .from(LISTINGS_TABLE)
        .update({
          tier: tier?.id || null,
          subscription_tier: tier?.id || "free",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from(LISTINGS_TABLE)
        .update({
          tier: "claimed",
          subscription_tier: "free",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
