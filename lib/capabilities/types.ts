/**
 * Capability type — small composable pieces of vertical behavior.
 *
 * A Capability owns one concern (a pricing model, a setup field, a
 * display widget). Verticals declare a list of capability slugs in
 * their VerticalConfig; the product form, pricing engine, storefront
 * PDP, and pull sheet dispatch to the capability's helpers when
 * handling a product that opts in.
 *
 * Phase 0 deliberately keeps this type minimal — slug, group, i18n
 * key. Later phases will add optional fields (productFormFields,
 * computeLineTotal, formatPullSheet, etc.) as the consumers learn
 * what they actually need from the dispatcher. Better to grow the
 * contract organically than to over-engineer it upfront.
 *
 * Design doc: docs/architecture/multi-vertical-capabilities.md
 */

export type CapabilityGroup =
  | "pricing"
  | "setup"
  | "mode"
  | "display"
  | "composition"
  | "service"
  | "order";

export type Capability = {
  /** Stable slug used in DB rows + registry lookup. e.g. "pricing.flat-day" */
  slug: string;
  /** Logical group; used for ordering form sections + filtering. */
  group: CapabilityGroup;
  /** Dot-path into the Messages tree, e.g. "capabilities.pricing.flatDay" */
  i18nKey: string;
};
