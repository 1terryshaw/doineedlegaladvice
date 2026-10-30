import type { Listing } from "@/lib/supabase";

/** Readable fallback for controlled or future listing type values. */
export function listingTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const known: Record<string, string> = {
    nonprofit_legal_aid: "Nonprofit legal aid",
    attorney: "Attorney",
    immigration: "Immigration",
  };
  return known[value] ?? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Make stored service identifiers readable when they are displayed as chips. */
export function serviceLabel(value: string): string {
  if (value === "nonprofit_legal_aid") return "Nonprofit legal aid";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ListingNameGroup {
  key: string;
  listings: Listing[];
  cities: string[];
}

export function normalizeListingName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "");
}

/** Group same-name locations within the supplied result set, retaining first-result order. */
export function groupListingsByName(listings: Listing[]): ListingNameGroup[] {
  const groups = new Map<string, ListingNameGroup>();
  for (const listing of listings) {
    const key = normalizeListingName(listing.name);
    const group = groups.get(key) ?? { key, listings: [], cities: [] };
    group.listings.push(listing);
    const city = listing.city?.trim();
    if (city && !group.cities.includes(city)) group.cities.push(city);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}
