// lib/uk-seo.ts — JSON-LD + canonical helpers for the /uk/ section.
//
// Deliberately emits NO AggregateRating and NO Review nodes: the UK pilot delivers no
// reviews, and stamping rating schema would re-introduce the exact false-claim problem
// the empire reviews/pricing workstream is removing. Addresses are GB; UK relevance is
// content-driven (UK firms, UK addresses) — no hreflang on these unique-per-geo pages.
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import verticalConfig from "@/lib/vertical.config";
import type { UkFirm } from "@/lib/uk-solicitors";

export function ukCanonicalPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/**
 * Page metadata for /uk/ routes: canonical (relative, resolved against metadataBase),
 * OG, and Twitter Card. locale en_GB signals the UK market via content, not hreflang.
 */
export function ukPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = ukCanonicalPath(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    ...(opts.index === false ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: verticalConfig.name,
      type: "website",
      locale: "en_GB",
    },
    twitter: {
      card: "summary",
      title: opts.title,
      description: opts.description,
    },
  };
}

/** Home -> UK -> ...crumbs. Each crumb is { name, path } where path is site-relative. */
export function ukBreadcrumbSchema(crumbs: Array<{ name: string; path: string }>) {
  const base = [{ name: "Home", path: "/" }, { name: "UK Solicitors", path: "/uk" }];
  const all = [...base, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: ukCanonicalPath(c.path),
    })),
  };
}

export function ukCollectionPageSchema(
  name: string,
  path: string,
  firmCount: number,
  areaName: string
) {
  const noun = firmCount === 1 ? "solicitor" : "solicitors";
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: ukCanonicalPath(path),
    description: `Browse ${firmCount} ${noun} in ${areaName}, United Kingdom.`,
  };
}

/**
 * LegalService schema for a single firm. Includes PostalAddress (GB), optional
 * ContactPoint (telephone), website, and the firm's geographic area. No rating nodes.
 */
export function ukFirmSchema(firm: UkFirm) {
  const slug = firm.id;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: firm.business_name,
    url: ukCanonicalPath(`/uk/directory/${slug}`),
    address: {
      "@type": "PostalAddress",
      ...(firm.registered_address ? { streetAddress: firm.registered_address } : {}),
      ...(firm.town ? { addressLocality: firm.town } : {}),
      ...(firm.county ? { addressRegion: firm.county } : {}),
      ...(firm.postcode ? { postalCode: firm.postcode } : {}),
      addressCountry: "GB",
    },
  };
  if (firm.website) schema.sameAs = [firm.website];
  if (firm.phone) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      telephone: firm.phone,
      contactType: "customer service",
      areaServed: "GB",
    };
    schema.telephone = firm.phone;
  }
  if (firm.town || firm.county) {
    schema.areaServed = {
      "@type": "City",
      name: firm.town || firm.county,
    };
  }
  schema.provider = {
    "@type": "Organization",
    name: verticalConfig.name,
    url: SITE_URL,
  };
  return schema;
}
