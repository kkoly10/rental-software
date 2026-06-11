import type { MetadataRoute } from "next";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getCanonicalUrl, getRequestOrigin } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import { listLandingPageSlugs } from "@/lib/verticals/registry";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [origin, tenant] = await Promise.all([
    getRequestOrigin(),
    isTenantHost(),
  ]);

  const u = (path: string) => getCanonicalUrl(path, origin);

  if (tenant) {
    // Tenant storefronts expose their own public pages + product detail
    // pages — that's the operator's local-SEO surface.
    const products = await getCatalogList();
    const staticRoutes: MetadataRoute.Sitemap = [
      { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
      { url: u("/inventory"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: u("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
      { url: u("/order-status"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ];
    const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
      url: u(`/inventory/${product.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticRoutes, ...productRoutes];
  }

  // Root marketing domain. Storefront routes (/inventory, /checkout,
  // product pages) 404 here by design — requirePublicOrg() blocks them —
  // so they must NOT be in this sitemap (the previous version listed
  // them and pointed crawlers at dead URLs). Auth utility pages
  // (login/signup/forgot-password) are deliberately excluded too:
  // they're not landing surfaces and waste crawl budget.
  // /contact is intentionally absent: it's a STOREFRONT page
  // (requirePublicOrg + org contact details). On a properly configured
  // root domain it 404s; with NEXT_PUBLIC_APP_DOMAIN unset it renders
  // an empty brandless shell. Either way it's not a root-domain
  // landing surface. (Codex review on #376.)
  const marketingRoutes: MetadataRoute.Sitemap = [
    { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: u("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: u("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: u("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // The six "<vertical> rental software" SEO pages — the highest-value
  // organic surface on the root domain.
  const verticalRoutes: MetadataRoute.Sitemap = listLandingPageSlugs().map(
    (slug) => ({
      url: u(`/${slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    })
  );

  return [...marketingRoutes, ...verticalRoutes];
}
