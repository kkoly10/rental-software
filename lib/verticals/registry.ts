import type { VerticalConfig } from "./types.ts";
import { validateCapabilitySlugs } from "../capabilities/registry.ts";
import { inflatableVertical } from "./inflatables.ts";
import { tentsVertical } from "./tents.ts";
import { tablesAndChairsVertical } from "./tables-and-chairs.ts";
import { danceFloorsVertical } from "./dance-floors.ts";
import { photoBoothsVertical } from "./photo-booths.ts";
import { concessionsVertical } from "./concessions.ts";

/**
 * Central registry of every vertical the app supports.
 *
 * Phase 0 shipped `inflatable`. Phase 2c added the wedding/banquet
 * triad — tents, tables-and-chairs, dance-floors. Phase 2d adds
 * photo-booths + concessions to complete the day-one 6, each
 * composing a subset of the 13 capabilities registered by Phase 1.
 */

const all: readonly VerticalConfig[] = [
  inflatableVertical,
  tentsVertical,
  tablesAndChairsVertical,
  danceFloorsVertical,
  photoBoothsVertical,
  concessionsVertical,
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
  return all.find((v) => v.marketing.landingPageSlug === landingSlug);
}

export function listVerticals(): readonly VerticalConfig[] {
  return all;
}

export function listVerticalSlugs(): readonly string[] {
  return all.map((v) => v.slug);
}

/**
 * Every marketing landing slug currently served. Used by
 * generateStaticParams() so Next.js can pre-render the routes.
 */
export function listLandingPageSlugs(): readonly string[] {
  return all.map((v) => v.marketing.landingPageSlug);
}
