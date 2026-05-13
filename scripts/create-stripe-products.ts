import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Creates Stripe products and prices for directory listing tiers.
 * Run: npx ts-node scripts/create-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY in .env.local
 */

import Stripe from "stripe";
import * as fs from "fs";

// Use require for CJS compatibility with ts-node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const verticalConfig = require("../lib/vertical.config").default;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const tiers = [
  { name: `${verticalConfig.name} Pro`, price: 7900, description: "Pro directory listing with priority placement" },
  { name: `${verticalConfig.name} Premium`, price: 14900, description: "Premium directory listing with top placement" },
  { name: `${verticalConfig.name} Growth`, price: 24900, description: "Growth directory listing with maximum visibility" },
];

async function main() {
  console.log("Creating Stripe products and prices...\n");

  const priceIds: string[] = [];

  for (const tier of tiers) {
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.price,
      currency: "cad",
      recurring: { interval: "month" },
    });

    priceIds.push(price.id);

    console.log(`${tier.name}:`);
    console.log(`  Product ID: ${product.id}`);
    console.log(`  Price ID:   ${price.id}`);
    console.log(`  Amount:     $${tier.price / 100}/month\n`);
  }

  // Auto-write price IDs into lib/pricing.ts
  const pricingPath = resolve(__dirname, "../lib/pricing.ts");
  let pricingContent = fs.readFileSync(pricingPath, "utf-8");

  for (const priceId of priceIds) {
    pricingContent = pricingContent.replace("PASTE_STRIPE_PRICE_ID_HERE", priceId);
  }

  fs.writeFileSync(pricingPath, pricingContent, "utf-8");
  console.log("Price IDs written to lib/pricing.ts");
}

main().catch(console.error);
