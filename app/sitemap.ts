import type { MetadataRoute } from "next";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getCanonicalUrl } from "@/lib/seo/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await getCatalogList();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getCanonicalUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/inventory"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: getCanonicalUrl("/checkout"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: getCanonicalUrl("/login"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("/signup"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("/forgot-password"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: getCanonicalUrl(`/inventory/${product.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
