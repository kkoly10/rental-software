import type { VerticalConfig } from "./types.ts";
import { validateCapabilitySlugs } from "../capabilities/registry.ts";
import { inflatableVertical } from "./inflatables.ts";
import { tentsVertical } from "./tents.ts";
import { tablesAndChairsVertical } from "./tables-and-chairs.ts";
import { danceFloorsVertical } from "./dance-floors.ts";
import { photoBoothsVertical } from "./photo-booths.ts";
import { concessionsVertical } from "./concessions.ts";
import { otherVertical } from "./other.ts";

/**
 * Central registry of every vertical the app supports.
 *
 * Phase 0 shipped `inflatable`. Phase 2c added the wedding/banquet
 * triad — tents, tables-and-chairs, dance-floors. Phase 2d adds
 * photo-booths + concessions to complete the day-one 6, each
 * composing a subset of the 13 capabilities registered by Phase 1.
 *
 * `otherVertical` is a SETUP-ONLY catch-all (kept last): it is a valid
 * signup business type but is filtered out of every marketing surface.
 * See listMarketedVerticals() and the setupOnly checks below.
 */

const all: readonly VerticalConfig[] = [
  inflatableVertical,
  tentsVertical,
  tablesAndChairsVertical,
  danceFloorsVertical,
  photoBoothsVertical,
  concessionsVertical,
  // Setup-only — must stay LAST so validVerticals[0] (the onboarding
  // fallback) remains a real marketed vertical.
  otherVertical,
];

const bySlug = new Map<string, VerticalConfig>(
  all.map((v) => [v.slug, v] as const),
);

// Boot-time validation: every capability slug referenced by a
// vertical config must exist in the capability registry. A typo here
// would otherwise silently break dispatch for that vertical at runtime.
for (const v of all) {
  const result = validateCapabilitySlugs(v.capabilities);
  if (!result.ok) {
    throw new Error(
      `Vertical "${v.slug}" references unknown capability slug(s): ${result.unknownSlugs.join(", ")}`,
    );
  }
}

export function getVertical(slug: string): VerticalConfig | undefined {
  return bySlug.get(slug);
}

/**
 * Look up a vertical by its public marketing URL slug — e.g.
 * "inflatable-rental-software" returns the inflatable vertical
 * config. Used by the dynamic /[vertical]/page.tsx route to
 * resolve which vertical a marketing URL belongs to.
 *
 * Returns undefined for unknown slugs; the caller should call
 * Next.js notFound() so the URL 404s rather than serving a
 * generic page.
 */
export function findVerticalByLandingSlug(
  landingSlug: string,
): VerticalConfig | undefined {
  // Setup-only verticals have no marketing page — a crafted URL for one
  // must 404, not serve its inert marketing stub.
  return all.find(
    (v) => !v.setupOnly && v.marketing.landingPageSlug === landingSlug,
  );
}

export function listVerticals(): readonly VerticalConfig[] {
  return all;
}

/**
 * Marketed verticals only — excludes setup-only catch-alls like
 * "other". Used by every public marketing surface (landing pages,
 * sitemap, footer, sibling links) so the generic general-rental option
 * never appears as a marketed page.
 */
export function listMarketedVerticals(): readonly VerticalConfig[] {
  return all.filter((v) => !v.setupOnly);
}

export function listVerticalSlugs(): readonly string[] {
  return all.map((v) => v.slug);
}

/**
 * Every marketing landing slug currently served. Used by
 * generateStaticParams() so Next.js can pre-render the routes.
 * Excludes setup-only verticals (no landing page for "other").
 */
export function listLandingPageSlugs(): readonly string[] {
  return listMarketedVerticals().map((v) => v.marketing.landingPageSlug);
}
