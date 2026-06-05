import type { VerticalConfig } from "./types.ts";
import { validateCapabilitySlugs } from "../capabilities/registry.ts";
import { inflatableVertical } from "./inflatables.ts";

/**
 * Central registry of every vertical the app supports.
 *
 * Phase 0 ships with just `inflatable` — the existing mature vertical
 * extracted into the new config shape. Tents, tables & chairs, dance
 * floors, photo booths, and concessions land as separate entries in
 * Phase 2 of the multi-vertical buildout.
 */

const all: readonly VerticalConfig[] = [inflatableVertical];

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

export function listVerticals(): readonly VerticalConfig[] {
  return all;
}

export function listVerticalSlugs(): readonly string[] {
  return all.map((v) => v.slug);
}
