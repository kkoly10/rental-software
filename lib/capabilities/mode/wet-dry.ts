import type { Capability } from "../types.ts";

/**
 * Wet/dry mode capability — currently inflatable-only. A product
 * declaring this capability exposes the wet/dry toggle in the product
 * form and the storefront PDP, and the wet upcharge flows through
 * the line-total calculation.
 *
 * Phase 0: metadata only. The existing behavior (computeInflatable-
 * LineTotal, normalizeSelectedMode, reconcileWetUpchargeCents) keeps
 * living in lib/pricing/inflatable-mode.ts and existing callers
 * continue to import it directly — zero behavior change.
 *
 * Phase 1+: when the pricing engine dispatches via capability slug,
 * this module will re-export the helpers under capability-named
 * aliases (computeWetDryLineTotal, etc.) so the dispatcher doesn't
 * need to know about the "inflatable" prefix.
 */
export const wetDryMode: Capability = {
  slug: "mode.wet-dry",
  group: "mode",
  i18nKey: "capabilities.mode.wetDry",
};
