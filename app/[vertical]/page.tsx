import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerticalLanding } from "@/components/marketing/vertical-landing";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import {
  findVerticalByLandingSlug,
  listLandingPageSlugs,
} from "@/lib/verticals/registry";

/**
 * Phase 2a/2b — dynamic vertical landing route.
 *
 * Serves the SEO-targeted /<vertical-slug> URLs (e.g.
 * /inflatable-rental-software). Validates the slug against the
 * vertical registry; unknown slugs 404. Returns vertical-specific
 * metadata so Google can match the URL to the search query
 * ("inflatable rental software", etc.) and so the canonical tag
 * points at THIS URL, not the root.
 *
 * Phase 2b: SEO + content now read from VerticalConfig.marketing
 * instead of a local map, and the page renders the dedicated
 * <VerticalLanding /> template (smaller + more conversion-focused
 * than the root SaaS landing). Adding a vertical = adding a config
 * file + images; no edits required here.
 */

type RouteParams = {
  params: Promise<{ vertical: string }>;
};

export async function generateStaticParams() {
  return listLandingPageSlugs().map((vertical) => ({ vertical }));
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { vertical } = await params;
  const config = findVerticalByLandingSlug(vertical);
  if (!config) {
    // The page itself will notFound() — return minimal metadata so
    // the 404 page rendering doesn't break upstream.
    return { robots: { index: false, follow: false } };
  }

  return await buildPageMetadata({
    title: config.marketing.seoTitle,
    description: config.marketing.seoDescription,
    path: `/${vertical}`,
  });
}

export default async function VerticalLandingPage({ params }: RouteParams) {
  const { vertical } = await params;
  const config = findVerticalByLandingSlug(vertical);

  if (!config) {
    notFound();
  }

  // Tenant subdomains shouldn't serve marketing pages; their root
  // serves the operator's storefront. If a marketing URL is hit on
  // a tenant host, 404 rather than render the wrong thing.
  if (await isTenantHost()) {
    notFound();
  }

  const origin = await getRequestOrigin();
  const canonical = `${origin}/${vertical}`;

  return (
    <>
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: config.marketing.seoTitle,
          description: config.marketing.seoDescription,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "Korent",
            url: origin,
          },
        }}
      />
      <VerticalLanding vertical={config} />
    </>
  );
}
