import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaasLanding } from "@/components/marketing/saas-landing";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import {
  findVerticalByLandingSlug,
  listLandingPageSlugs,
} from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";

/**
 * Phase 2a — dynamic vertical landing route.
 *
 * Serves the SEO-targeted /<vertical-slug> URLs (e.g.
 * /inflatable-rental-software). Validates the slug against the
 * vertical registry; unknown slugs 404. Returns vertical-specific
 * metadata so Google can match the URL to the search query
 * ("inflatable rental software", etc.) and so the canonical tag
 * points at THIS URL, not the root.
 *
 * Phase 2a renders the existing SaaS landing for inflatable as a
 * pragmatic first step — Phase 2b refactors that component into a
 * configurable <VerticalLanding> driven by the VerticalConfig.
 */

type RouteParams = {
  params: Promise<{ vertical: string }>;
};

// Per-vertical marketing copy. Lives here in Phase 2a rather than in
// the VerticalConfig type because Phase 2b will reshape this when
// the SaasLanding component is generalized — better to keep the
// surface tight while it's still evolving.
const VERTICAL_SEO: Record<
  string,
  { title: string; description: string }
> = {
  inflatable: {
    title: "Inflatable Rental Software for Bounce House Operators | Korent",
    description:
      "Online booking, delivery routing, damage deposits, and crew dispatch — built for bounce house, water slide, and combo unit rental businesses. Start free; no credit card.",
  },
};

function seoForVertical(v: VerticalConfig): {
  title: string;
  description: string;
} {
  return (
    VERTICAL_SEO[v.slug] ?? {
      title: `${v.label.en} Rental Software | Korent`,
      description:
        `Online booking, delivery routing, deposits, and crew dispatch — ` +
        `built for ${v.label.en.toLowerCase()} rental businesses. Start free; no credit card.`,
    }
  );
}

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

  const seo = seoForVertical(config);
  return await buildPageMetadata({
    title: seo.title,
    description: seo.description,
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
  const seo = seoForVertical(config);
  const canonical = `${origin}/${vertical}`;

  return (
    <>
      {/* WebPage JSON-LD with the vertical-specific name + canonical.
          Reuses the script primitive to stay consistent with the rest
          of the marketing surface. */}
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: seo.title,
          description: seo.description,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "Korent",
            url: origin,
          },
        }}
      />
      <SaasLanding />
    </>
  );
}
