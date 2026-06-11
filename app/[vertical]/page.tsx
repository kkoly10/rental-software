import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerticalLanding } from "@/components/marketing/vertical-landing";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildPageMetadata, getRequestOrigin, getSiteBaseUrl } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import { getVerticalLandingCopy } from "@/lib/verticals/landing-copy";
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

  // Absolute OG image — the vertical's storefront hero photo. Social
  // crawlers require absolute URLs; the static site base is correct here
  // because vertical pages only render on the root marketing domain.
  const ogImage = config.storefrontDefaults?.heroImagePath
    ? `${getSiteBaseUrl()}${config.storefrontDefaults.heroImagePath}`
    : undefined;

  return await buildPageMetadata({
    title: config.marketing.seoTitle,
    description: config.marketing.seoDescription,
    path: `/${vertical}`,
    image: ogImage,
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
  const copy = getVerticalLandingCopy(config.slug);

  return (
    <>
      {/* SoftwareApplication — the schema type Google actually surfaces
          for "<vertical> software" queries. Offer mirrors the on-page
          "From $49/month" teaser (PLAN_TIERS.starter). No
          aggregateRating: we have no third-party ratings and won't
          fabricate one. */}
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `Korent — ${config.label.en} rental software`,
          description: config.marketing.seoDescription,
          url: canonical,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: "49.00",
            priceCurrency: "USD",
            description: "Starter plan, billed monthly. No per-booking fees.",
          },
        }}
      />
      {/* BreadcrumbList — Home → vertical page. */}
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Korent",
              item: origin,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: config.marketing.heroKicker,
              item: canonical,
            },
          ],
        }}
      />
      {/* FAQPage — mirrors the visible on-page FAQ exactly (schema must
          match rendered content). Rich-result eligibility is limited
          since 2023 but the markup still aids entity understanding. */}
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: copy.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <VerticalLanding vertical={config} />
    </>
  );
}
