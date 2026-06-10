import { getVertical } from "./registry.ts";

/**
 * PR-3a — per-vertical suggested capability set.
 *
 * The vertical's existing `capabilities` array IS the suggested-by-
 * default set: it lists the capabilities this vertical's products
 * typically declare. Reusing it (instead of a second registry field)
 * keeps a single source of truth — when an operator adds the
 * vertical, the suggested defaults inherit automatically.
 *
 * The operator product form uses this to:
 *   1. Pre-check the right capabilities on a new product
 *   2. Split the picker into "Suggested for <vertical>" vs.
 *      "Show advanced" so a bouncer operator never has to scroll
 *      past damage-waiver / attendant-hours to find anchoring.
 *
 * Returns an empty list for unknown / missing verticals; the form
 * falls back to the flat list in that case.
 */
export function getSuggestedCapabilities(verticalSlug: string | null): readonly string[] {
  if (!verticalSlug) return [];
  return getVertical(verticalSlug)?.capabilities ?? [];
}
