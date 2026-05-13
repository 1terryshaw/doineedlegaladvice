import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Seeds the database from a Google Sheet export.
 * Run: npx ts-node scripts/seed-from-google.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "legal_listings";

// Search queries for seeding Ontario lawyer listings
const SEARCH_QUERIES = [
  { query: "family lawyer Toronto Ontario", type: "family-lawyer", region: "toronto" },
  { query: "real estate lawyer Toronto Ontario", type: "real-estate-lawyer", region: "toronto" },
  { query: "immigration lawyer Toronto Ontario", type: "immigration-lawyer", region: "toronto" },
  { query: "criminal defence lawyer Toronto Ontario", type: "criminal-lawyer", region: "toronto" },
  { query: "personal injury lawyer Toronto Ontario", type: "personal-injury-lawyer", region: "toronto" },
  { query: "family lawyer Ottawa Ontario", type: "family-lawyer", region: "ottawa" },
  { query: "real estate lawyer Ottawa Ontario", type: "real-estate-lawyer", region: "ottawa" },
  { query: "family lawyer Mississauga Ontario", type: "family-lawyer", region: "mississauga" },
  { query: "business lawyer Toronto Ontario", type: "business-lawyer", region: "toronto" },
  { query: "employment lawyer Toronto Ontario", type: "employment-lawyer", region: "toronto" },
  { query: "estate lawyer Toronto Ontario", type: "estate-lawyer", region: "toronto" },
  { query: "immigration lawyer Ottawa Ontario", type: "immigration-lawyer", region: "ottawa" },
  { query: "criminal lawyer Hamilton Ontario", type: "criminal-lawyer", region: "hamilton" },
  { query: "family lawyer London Ontario", type: "family-lawyer", region: "london" },
  { query: "real estate lawyer Mississauga Ontario", type: "real-estate-lawyer", region: "mississauga" },
];

// CHANGE_ME: Replace with path to your Google Sheets CSV export
const CSV_PATH = "data/listings.csv";

import * as fs from "fs";

interface ListingRow {
  slug: string;
  name: string;
  description: string;
  short_description: string;
  phone: string;
  email: string;
  website?: string;
  city: string;
  province_state: string;
  country: string;
  region: string;
  type?: string;
  claimed: boolean;
  featured: boolean;
}

function parseCSV(content: string): ListingRow[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });

    return {
      slug: row.slug || row.name?.toLowerCase().replace(/\s+/g, "-") || "",
      name: row.name || "",
      description: row.description || "",
      short_description: row.short_description || row.description?.slice(0, 100) || "",
      phone: row.phone || "",
      email: row.email || "",
      website: row.website || undefined,
      city: row.city || "",
      province_state: row.province_state || row.province || row.state || "",
      country: row.country || "CA",
      region: row.region || "",
      type: row.type || "",
      claimed: false,
      featured: row.featured === "true" || row.featured === "yes",
    };
  });
}

async function main() {
  console.log("Search queries configured:", SEARCH_QUERIES.length);
  console.log("Table:", TABLE);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found: ${CSV_PATH}`);
    console.error("Export your Google Sheet as CSV and save it to this path.");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const listings = parseCSV(content);

  console.log(`Seeding ${listings.length} listings from Google Sheet into ${TABLE}...\n`);

  const { data, error } = await supabase.from(TABLE).insert(listings).select();

  if (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} listings successfully!`);
  data.forEach((l: { name: string; slug: string }) => console.log(`  - ${l.name} (${l.slug})`));
}

main().catch(console.error);
