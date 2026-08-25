import { MetadataRoute } from "next";
import verticalConfig from "@/lib/vertical.config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  return {
    rules: [
      { userAgent: "*", allow: "/" },
    ],
    // K32 Step 3 batch 1 (2026-08-24): the /uk sitemap index is advertised HERE and only here.
    // It cannot be referenced from /sitemap.xml — that is itself a <sitemapindex>, and the sitemap
    // protocol forbids a sitemap index pointing at another sitemap index. robots.txt is the only
    // valid wiring point for a second index. /uk pages are index,follow and leaf-verified healthy.
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/uk/sitemap.xml`],
  };
}
