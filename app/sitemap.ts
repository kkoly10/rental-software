import type { MetadataRoute } from "next";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getCanonicalUrl, getRequestOrigin } from "@/lib/seo/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [origin, products] = await Promise.all([
    getRequestOrigin(),
    getCatalogList(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getCanonicalUrl("/", origin),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/inventory", origin),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: getCanonicalUrl("/checkout", origin),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: getCanonicalUrl("/pricing", origin),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: getCanonicalUrl("/order-status", origin),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: getCanonicalUrl("/privacy", origin),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: getCanonicalUrl("/terms", origin),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: getCanonicalUrl("/contact", origin),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: getCanonicalUrl("/login", origin),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("/signup", origin),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("/forgot-password", origin),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: getCanonicalUrl(`/inventory/${product.slug}`, origin),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
