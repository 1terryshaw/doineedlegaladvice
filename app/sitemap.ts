import { MetadataRoute } from "next";
import verticalConfig from "@/lib/vertical.config";
import { getAllListingsForSitemap } from "@/lib/supabase";
import { REGIONS } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  const listings = await getAllListingsForSitemap();

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/directory`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
  ];

  const regionPages = REGIONS.map((region) => ({
    url: `${baseUrl}/${region.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const listingPages = listings.map((listing) => ({
    url: `${baseUrl}/directory/${listing.slug}`,
    lastModified: new Date(listing.updated_at || listing.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...regionPages, ...listingPages];
}
