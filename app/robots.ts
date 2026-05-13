import { MetadataRoute } from "next";
import verticalConfig from "@/lib/vertical.config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  return {
    rules: [
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
