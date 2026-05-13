import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Seeds the database with sample listings.
 * Run: npx ts-node scripts/seed-listings.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CHANGE_ME: Update table name to match your verticalConfig.tablePrefix
const TABLE = "legal_listings";

const sampleListings = [
  {
    slug: "sample-business-1",
    name: "Sample Business One",
    description: "A great local business providing excellent services to the community.",
    short_description: "Excellent local services",
    phone: "(555) 123-4567",
    email: "info@sample1.com",
    website: "https://sample1.com",
    city: "Toronto",
    province_state: "ON",
    country: "CA",
    region: "toronto",
    claimed: false,
    featured: true,
  },
  {
    slug: "sample-business-2",
    name: "Sample Business Two",
    description: "Professional services with years of experience and a dedicated team.",
    short_description: "Professional and experienced",
    phone: "(555) 987-6543",
    email: "hello@sample2.com",
    city: "Vancouver",
    province_state: "BC",
    country: "CA",
    region: "vancouver",
    claimed: false,
    featured: false,
  },
  {
    slug: "sample-business-3",
    name: "Sample Business Three",
    description: "Award-winning service provider known for quality and reliability.",
    short_description: "Award-winning service",
    phone: "(555) 456-7890",
    email: "contact@sample3.com",
    website: "https://sample3.com",
    city: "Montreal",
    province_state: "QC",
    country: "CA",
    region: "montreal",
    claimed: false,
    featured: true,
  },
];

async function main() {
  console.log(`Seeding ${sampleListings.length} listings into ${TABLE}...\n`);

  const { data, error } = await supabase.from(TABLE).insert(sampleListings).select();

  if (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} listings successfully!`);
  data.forEach((l) => console.log(`  - ${l.name} (${l.slug})`));
}

main().catch(console.error);
