// Adapter that normalises each repo's local vertical config into a canonical
// surface used by the OwnerEditForm v1 stamp. Each repo's verticalConfig has
// different field names (plumber: listingNoun; webdesigner: entity), and some
// fields may be absent. This file is the ONLY place the canonical depends on
// repo-specific config shape, so the stamper edits it once per repo.
//
// Stamping checklist (per repo):
//   1. Confirm the import line below matches the repo's export style:
//        - default export:  `import verticalConfig from "@/lib/vertical.config";`
//        - named export:    `import { verticalConfig } from "@/lib/vertical.config";`
//   2. Run a quick smoke read in dev: each `canonical.*` value should resolve
//      to a non-empty string for the target repo.

import verticalConfig from "@/lib/vertical.config";

const cfg = verticalConfig as unknown as Record<string, unknown>;

function pick(...keys: string[]): string {
  for (const k of keys) {
    const v = cfg[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

export const canonical = {
  // Singular noun used in meta descriptions and headers.
  // plumber: "plumber" (listingNoun) | webdesigner: "web designer" (entity)
  noun: pick("listingNoun", "entity") || "professional",

  // Plural noun used in directory copy.
  // plumber: "plumbers" (listingNounPlural) | webdesigner: "web designers" (entityPlural)
  nounPlural: pick("listingNounPlural", "entityPlural") || "professionals",

  // Brand colour used for buttons, badges, link hover states.
  primaryColor: pick("primaryColor") || "#1E3A5F",

  // Support email surfaced in error states.
  supportEmail: pick("supportEmail") || "support@example.com",

  // Public domain (used for absolute URLs in OG/JSON-LD where needed).
  domain: pick("domain") || "",

  // Underlying *_listings table prefix, e.g. "plumber_" or "webdesign_".
  tablePrefix: pick("tablePrefix") || "",
} as const;

// "plumber" / "webdesign" — used as the bucket key in listing_photos rows
// and as the storage object path namespace.
export const VERTICAL_KEY = canonical.tablePrefix.replace(/_$/, "");
