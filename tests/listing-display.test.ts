import assert from "node:assert/strict";
import test from "node:test";
import { groupListingsByName, listingTypeLabel, serviceLabel } from "../lib/listing-display";
import type { Listing } from "../lib/supabase";

const fixture = (name: string, slug: string, city: string): Listing => ({
  id: slug, slug, name, city, description: "", claimed: false, featured: false, created_at: "2026-01-01",
});

test("groups live-example branches by punctuation and case-insensitive normalized name", () => {
  const rows = [
    ...["Austin", "Dallas", "Houston"].map((city, i) => fixture("American Gateways", `american-${i}`, city)),
    ...["Austin", "Dallas", "Houston", "San Antonio"].map((city, i) => fixture("ARISE Adelante", `arise-${i}`, city)),
    ...["Austin", "Houston", "Dallas"].map((city, i) => fixture("BakerRipley", `baker-${i}`, city)),
  ];
  const groups = groupListingsByName(rows);
  assert.deepEqual(groups.map((g) => g.listings.length), [3, 4, 3]);
  assert.equal(groups[0].listings[0].slug, "american-0");
  assert.deepEqual(groups[1].cities, ["Austin", "Dallas", "Houston", "San Antonio"]);
});

test("normalizes punctuation and diacritics for duplicate matching", () => {
  const groups = groupListingsByName([
    fixture("BakerRipley", "baker-1", "Houston"),
    fixture("Baker-Ripley", "baker-2", "Dallas"),
    fixture("BAKÉR RIPLEY", "baker-3", "Austin"),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].listings.length, 3);
});

test("type labels never expose raw snake_case values", () => {
  assert.equal(listingTypeLabel("nonprofit_legal_aid"), "Nonprofit legal aid");
  assert.equal(listingTypeLabel("public_defender"), "Public Defender");
});

test("service chip labels map nonprofit legal aid and sentence-case other identifiers", () => {
  assert.equal(serviceLabel("nonprofit_legal_aid"), "Nonprofit legal aid");
  assert.equal(serviceLabel("immigration_legal_services"), "Immigration Legal Services");
  assert.equal(serviceLabel("family-law"), "Family Law");
});
