/**
 * Listing health score — a 0-10 measure of how complete and optimized a
 * listing is, with specific actions to improve it. Surfaced in the owner
 * dashboard for paid tiers (a Reviews Plus feature).
 */

export interface HealthItem {
  label: string;
  met: boolean;
  points: number;
  hint: string;
}

export interface ListingHealth {
  score: number;
  max: number;
  items: HealthItem[];
}

interface HealthInput {
  description?: string | null;
  services?: string[] | null;
  service_area?: string[] | null;
  gbp_url?: string | null;
  google_review_count?: number | null;
  updated_at?: string | null;
}

const FRESH_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export function computeListingHealth(
  listing: HealthInput,
  photoCount: number
): ListingHealth {
  const description = (listing.description ?? "").trim();
  const services = listing.services ?? [];
  const serviceArea = listing.service_area ?? [];
  const reviewCount = listing.google_review_count ?? 0;
  const updatedAt = listing.updated_at ? new Date(listing.updated_at).getTime() : 0;
  const isFresh = updatedAt > 0 && Date.now() - updatedAt < FRESH_WINDOW_MS;
  const photosNeeded = Math.max(0, 3 - photoCount);

  const items: HealthItem[] = [
    {
      label: "Business description",
      met: description.length >= 40,
      points: 2,
      hint: "Write a description of at least a sentence or two.",
    },
    {
      label: "At least 3 photos",
      met: photoCount >= 3,
      points: 2,
      hint: `Add ${photosNeeded} more photo${photosNeeded === 1 ? "" : "s"} — listings with photos get more clicks.`,
    },
    {
      label: "Services listed",
      met: services.length > 0,
      points: 1,
      hint: "List the services you offer so searchers can find you.",
    },
    {
      label: "Service area set",
      met: serviceArea.length > 0,
      points: 1,
      hint: "Add the cities or regions you serve.",
    },
    {
      label: "Google Business Profile linked",
      met: Boolean(listing.gbp_url),
      points: 1,
      hint: "Link your Google Business Profile so searchers can find your reviews.",
    },
    {
      label: "5 or more Google reviews",
      met: reviewCount >= 5,
      points: 2,
      hint: "Ask recent customers for Google reviews — see your Welcome to Reviews Plus guide.",
    },
    {
      label: "Updated in the last 90 days",
      met: isFresh,
      points: 1,
      hint: "Edit your listing so the information stays current.",
    },
  ];

  const score = items.reduce((sum, it) => sum + (it.met ? it.points : 0), 0);
  const max = items.reduce((sum, it) => sum + it.points, 0);
  return { score, max, items };
}
