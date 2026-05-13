import type { MetadataRoute } from "next";
import { getRequestOrigin } from "@/lib/seo/metadata";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getRequestOrigin();

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
