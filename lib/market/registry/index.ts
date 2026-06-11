import { categories } from "./categories.ts";
import { riskFamilies, riskFamilyBySlug } from "./risk-families.ts";
import { worldBySlug, worlds } from "./worlds.ts";
import type {
  MarketCategory,
  OperatingDefaults,
  RiskFamily,
  World,
} from "./types.ts";

export { worlds, worldBySlug } from "./worlds.ts";
export { categories } from "./categories.ts";
export { riskFamilies, riskFamilyBySlug } from "./risk-families.ts";
export { restrictedItems, getRestrictedItemRule } from "./restricted-items.ts";
export {
  metros,
  metroBySlug,
  DEFAULT_METRO_SLUG,
  graduationGates,
  RESERVED_MARKETPLACE_SUBDOMAINS,
} from "./launch.ts";
export type * from "./types.ts";

/**
 * Boot-time validation, mirroring lib/verticals/registry.ts: a typo
 * in the config should crash the build/tests, never ship as a silent
 * runtime miss.
 */
function validateRegistry() {
  const worldSlugs = new Set(worlds.map((w) => w.slug));
  if (worldSlugs.size !== worlds.length) {
    throw new Error("Marketplace registry: duplicate world slugs");
  }

  const seen = new Set<string>();
  for (const c of categories) {
    if (!worldSlugs.has(c.worldSlug)) {
      throw new Error(
        `Marketplace registry: category "${c.slug}" references unknown world "${c.worldSlug}"`,
      );
    }
    if (!riskFamilyBySlug.has(c.riskFamilySlug)) {
      throw new Error(
        `Marketplace registry: category "${c.worldSlug}/${c.slug}" references unknown risk family "${c.riskFamilySlug}"`,
      );
    }
    // World-scoped uniqueness (spec §3): the canonical identity is
    // world/category; the same bare slug in two worlds is legal.
    const key = `${c.worldSlug}/${c.slug}`;
    if (seen.has(key)) {
      throw new Error(`Marketplace registry: duplicate category "${key}"`);
    }
    seen.add(key);
  }

  for (const w of worlds) {
    if (!categories.some((c) => c.worldSlug === w.slug)) {
      throw new Error(`Marketplace registry: world "${w.slug}" has no categories`);
    }
  }
}

validateRegistry();

export function getWorld(slug: string): World | undefined {
  return worldBySlug.get(slug);
}

export function listWorldCategories(worldSlug: string): readonly MarketCategory[] {
  return categories.filter((c) => c.worldSlug === worldSlug);
}

export function getCategory(
  worldSlug: string,
  categorySlug: string,
): MarketCategory | undefined {
  return categories.find(
    (c) => c.worldSlug === worldSlug && c.slug === categorySlug,
  );
}

export function getRiskFamily(slug: string): RiskFamily | undefined {
  return riskFamilyBySlug.get(slug);
}

/**
 * Resolve the full operating defaults for a category (spec §6):
 * risk-family defaults overlaid with category overrides. Throws on
 * unknown identifiers — callers should only pass registry slugs.
 */
export function resolveOperatingDefaults(
  worldSlug: string,
  categorySlug: string,
): OperatingDefaults {
  const category = getCategory(worldSlug, categorySlug);
  if (!category) {
    throw new Error(
      `Marketplace registry: unknown category "${worldSlug}/${categorySlug}"`,
    );
  }
  const family = riskFamilyBySlug.get(category.riskFamilySlug);
  if (!family) {
    throw new Error(
      `Marketplace registry: unknown risk family "${category.riskFamilySlug}"`,
    );
  }
  return { ...family.defaults, ...category.overrides };
}
