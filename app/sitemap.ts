import type { MetadataRoute } from "next";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getCanonicalUrl, getRequestOrigin } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [origin, products, tenant] = await Promise.all([
    getRequestOrigin(),
    getCatalogList(),
    isTenantHost(),
  ]);

  const u = (path: string) => getCanonicalUrl(path, origin);

  // Tenant storefronts only expose their own public pages.
  // Marketing/auth routes (pricing, login, signup, privacy, terms) return 404
  // or redirect on tenant hosts — exclude them so crawlers don't index 404s.
  const staticRoutes: MetadataRoute.Sitemap = tenant
    ? [
        { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: u("/inventory"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: u("/checkout"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: u("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: u("/order-status"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
      ]
    : [
        { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: u("/inventory"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: u("/checkout"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: u("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
        { url: u("/order-status"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: u("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
        { url: u("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
        { url: u("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: u("/login"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
        { url: u("/signup"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
        { url: u("/forgot-password"), lastModified: now, changeFrequency: "yearly", priority: 0.1 },
      ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: u(`/inventory/${product.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
