import type { Capability, CapabilityGroup } from "./types.ts";
import { flatDayPricing } from "./pricing/flat-day.ts";
import { perHourPricing } from "./pricing/per-hour.ts";
import { wetDryMode } from "./mode/wet-dry.ts";
import { anchoringSetup } from "./setup/anchoring.ts";
import { surfaceTypeSetup } from "./setup/surface-type.ts";

/**
 * Central registry of every capability the app knows about.
 *
 * Adding a capability:
 *   1. Create lib/capabilities/<group>/<name>.ts exporting a Capability
 *   2. Add the import + push into the `all` array below
 *   3. (Optional) Add a vertical config in lib/verticals/<slug>.ts that
 *      lists the new capability slug
 *
 * Lookup is O(1) by slug via the internal Map. The list-by-group
 * helper is O(n) but the n is small (≤ ~20) so no index needed.
 */

const all: readonly Capability[] = [
  flatDayPricing,
  perHourPricing,
  wetDryMode,
  anchoringSetup,
  surfaceTypeSetup,
];

const bySlug = new Map<string, Capability>(
  all.map((c) => [c.slug, c] as const),
);

export function getCapability(slug: string): Capability | undefined {
  return bySlug.get(slug);
}

export function listCapabilities(): readonly Capability[] {
  return all;
}

export function listCapabilitiesByGroup(
  group: CapabilityGroup,
): readonly Capability[] {
  return all.filter((c) => c.group === group);
}

/**
 * Validate that every slug in `slugs` is registered. Used at boot to
 * verify a vertical config doesn't reference a non-existent capability,
 * and at order-replay to catch a row whose capability_slugs include a
 * slug the current build no longer knows about.
 */
export function validateCapabilitySlugs(slugs: readonly string[]): {
  ok: true;
} | {
  ok: false;
  unknownSlugs: string[];
} {
  const unknown = slugs.filter((s) => !bySlug.has(s));
  return unknown.length === 0
    ? { ok: true }
    : { ok: false, unknownSlugs: unknown };
}
