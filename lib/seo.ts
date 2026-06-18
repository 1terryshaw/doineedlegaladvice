import verticalConfig from "@/lib/vertical.config";
import { regionCountryLabel } from "@/lib/region-scope";

/**
 * Production canonical site URL. Reads NEXT_PUBLIC_BASE_URL env override first
 * (set in Vercel production env), falls back to verticalConfig.domain which is
 * stored as www form (Fix-7 standard).
 *
 * Trailing slash stripped so callers can concatenate paths safely.
 */
const cfgDomain = (verticalConfig as { domain?: string }).domain;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  (cfgDomain ? `https://${cfgDomain}` : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Build an absolute canonical URL for the given path.
 * Pass paths starting with "/" (e.g. "/directory", "/toronto/toronto").
 */
export function canonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/**
 * Sitewide Organization schema (F-α.1b Step 1). Inject as <script
 * type="application/ld+json"> in the root layout so every page inherits it.
 * contactPoint is conditional: omitted when verticalConfig.supportEmail is
 * absent (avoids emitting an empty ContactPoint via JSON.stringify).
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: verticalConfig.name,
    url: SITE_URL,
    description: verticalConfig.description,
    ...((verticalConfig as { supportEmail?: string }).supportEmail
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            email: (verticalConfig as { supportEmail?: string }).supportEmail,
            contactType: "customer support",
          },
        }
      : {}),
  };
}

/**
 * Homepage-only WebSite schema with potentialAction:SearchAction (F-α.1b
 * Step 2). Eligible for Google's sitelinks search box. /directory?q= verified.
 */
export function websiteSearchSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: SITE_URL,
    name: verticalConfig.name,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/directory?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * BreadcrumbList for region pages. Home → {Country} → {region}. Country crumb
 * (us+ca consolidation) derived from the region code so US pages read "United
 * States" and CA pages "Canada"; the country crumb links to /directory (us+ca).
 */
export function regionBreadcrumbSchema(regionSlug: string, regionName: string) {
  const country = regionCountryLabel(regionSlug);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: country, item: `${SITE_URL}/directory` },
      { "@type": "ListItem", position: 3, name: regionName, item: `${SITE_URL}/${regionSlug}` },
    ],
  };
}

/**
 * BreadcrumbList for city pages. Home → {Country} → {region} → {city}.
 */
export function cityBreadcrumbSchema(
  regionSlug: string,
  regionName: string,
  citySlug: string,
  cityName: string,
) {
  const country = regionCountryLabel(regionSlug);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: country, item: `${SITE_URL}/directory` },
      { "@type": "ListItem", position: 3, name: regionName, item: `${SITE_URL}/${regionSlug}` },
      { "@type": "ListItem", position: 4, name: cityName, item: `${SITE_URL}/${regionSlug}/${citySlug}` },
    ],
  };
}

/**
 * Minimal CollectionPage for region pages (F-α.1b Step 3). Noun read from
 * verticalConfig.listingNounPlural (singular fallback for count===1). Province
 * dropped from bookkeeper's 4-arg form (no uniform source empire-wide).
 * No nested ItemList — kept minimal to avoid per-listing validation risk.
 */
export function regionCollectionPageSchema(
  regionSlug: string,
  regionName: string,
  listingCount: number,
) {
  const plural = (verticalConfig as { listingNounPlural?: string; listingNoun?: string }).listingNounPlural ?? "listings";
  const singular = (verticalConfig as { listingNoun?: string }).listingNoun ?? plural;
  const noun = listingCount === 1 ? singular : plural;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${plural} in ${regionName}`,
    url: `${SITE_URL}/${regionSlug}`,
    description: `Browse ${listingCount} ${noun} in ${regionName}.`,
  };
}
