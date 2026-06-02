/**
 * Single source of truth for "an asset can fulfill a booking" status
 * values. Several call sites (availability check, storefront product
 * counts, asset creation defaults) historically inlined the literal
 * `["ready", "available", "active"]` array; if a new bookable status
 * is ever introduced, this is the constant to update.
 *
 * `as const` so callers get the narrow union type when they need it
 * (e.g. for status form selects).
 */
export const BOOKABLE_ASSET_STATUSES = ["ready", "available", "active"] as const;

export type BookableAssetStatus = (typeof BOOKABLE_ASSET_STATUSES)[number];
