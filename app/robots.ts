import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/inventory", "/checkout"],
      disallow: ["/dashboard", "/crew", "/onboarding", "/api", "/auth"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
