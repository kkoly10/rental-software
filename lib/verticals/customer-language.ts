import { getVertical } from "./registry.ts";

/**
 * Customer-facing language helpers — adapt storefront copy to the
 * operator's vertical without degrading the marketed event verticals.
 *
 * The six marketed verticals (inflatables, tents, tables-and-chairs,
 * dance-floors, photo-booths, concessions) are all event rentals, so
 * "your event" reads correctly for them. The setup-only "other" / general
 * vertical is NOT event-bound (tools, AV, furniture, equipment), where
 * "your event" reads wrong. Rather than inject an English noun into
 * localized strings, callers pick a localized "*General" copy variant
 * when `isGeneralVertical` is true; event verticals keep their existing
 * copy byte-for-byte.
 */
export function isGeneralVertical(verticalSlug: string | null | undefined): boolean {
  if (!verticalSlug) return false;
  // Setup-only verticals (today just "other") are the general catch-all.
  // Keying off the flag — not a slug literal — means any future
  // setup-only vertical inherits the neutral copy automatically.
  return getVertical(verticalSlug)?.setupOnly === true;
}
