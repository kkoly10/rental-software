/**
 * Marketplace policy registry — types.
 *
 * The registry is configuration-as-code, following the same pattern as
 * lib/capabilities + lib/verticals: plain TS modules validated at boot,
 * no classes, no DB round-trips. Spec: MARKETPLACE_MASTER_PLAN.md §3–§6.
 *
 * IMPORTANT (spec §3): category slugs are scoped to their world. The
 * canonical identity of a category is `${worldSlug}/${categorySlug}` —
 * the same bare slug may exist in multiple worlds (e.g.
 * chairs-and-seating in both hosting-and-events and office-and-pop-up).
 */

export type WorldSlug =
  | "home-and-projects"
  | "hosting-and-events"
  | "baby-gear"
  | "creator-gear"
  | "trailers-and-hauling"
  | "office-and-pop-up"
  | "seasonal-and-emergency";

export type RiskFamilySlug =
  | "passive-standard"
  | "furniture-standard"
  | "powered-standard"
  | "electronics-standard"
  | "high-value-electronics"
  | "towable-road"
  | "baby-sensitive"
  | "food-contact"
  | "restoration-and-emergency"
  | "multi-component-event"
  | "manual-review-restricted";

export type SecondaryTag =
  | "furniture"
  | "event-furniture"
  | "office-furniture"
  | "staging-furniture"
  | "lounge-furniture"
  | "powered-equipment"
  | "motorized-equipment"
  | "electric-equipment"
  | "high-value"
  | "high-fraud-risk"
  | "manual-review-preferred"
  | "child-contact"
  | "food-contact"
  | "sanitation-sensitive"
  | "delivery-heavy"
  | "pickup-preferred"
  | "onsite-setup"
  | "multi-component"
  | "serial-required"
  | "vin-required"
  | "restricted-item"
  | "age-restricted";

/** Smoke-test mode per spec §31: browsable + waitlist, not bookable. */
export type WorldStatus = "live" | "smoke_test";

export type World = {
  slug: WorldSlug;
  label: string;
  /** Single emoji used as the lightweight icon on world tiles. */
  icon: string;
  tagline: string;
  status: WorldStatus;
};

export type IdentityVerificationLevel = "payment_method" | "full_id";
export type SanitationClass = "none" | "standard" | "strict";
export type DisputeSensitivity = "low" | "medium" | "high";
export type DepositStrategy =
  | "none"
  | "auth_hold"
  | "captured_refundable"
  | "manual_review";

/**
 * The operating defaults every category must resolve (spec §6).
 * Risk-family defaults exist for all fields; categories may override
 * any subset.
 */
export type OperatingDefaults = {
  /** request-to-book unless instant book is explicitly allowed */
  instantBookAllowed: boolean;
  depositStrategy: DepositStrategy;
  /** % of estimated used value (spec §9), 0–100 */
  depositPct: number;
  depositFloorCents: number;
  proofOfFunctionRequired: boolean;
  sanitationClass: SanitationClass;
  identityVerification: IdentityVerificationLevel;
  deliveryAllowed: boolean;
  disputeSensitivity: DisputeSensitivity;
  minBookingSubtotalCents: number;
  accessoriesChecklistRequired: boolean;
  serialNumberRequired: boolean;
  /** §6 seller review requirement: listings in this category enter
   *  pending_review instead of publishing directly. */
  listingReviewRequired: boolean;
  /** §14 turnaround buffers */
  prepBufferMinutes: number;
  recoveryBufferMinutes: number;
  /** §8 target daily price as % of replacement value (benchmark default) */
  targetDailyPctOfReplacement: number;
};

export type RiskFamily = {
  slug: RiskFamilySlug;
  label: string;
  defaults: OperatingDefaults;
};

export type MarketCategory = {
  /** World-scoped slug — unique within its world only. */
  slug: string;
  worldSlug: WorldSlug;
  label: string;
  riskFamilySlug: RiskFamilySlug;
  tags: readonly SecondaryTag[];
  /** Optional per-category refinements over the risk-family defaults. */
  overrides?: Partial<OperatingDefaults>;
};

export type RestrictionLevel =
  | "prohibited"
  | "restricted_manual_review"
  | "allowed_with_extra_requirements"
  | "allowed_standard";

export type RestrictedItemRule = {
  slug: string;
  label: string;
  level: RestrictionLevel;
  /** Why, and what extra requirement applies if conditional. */
  note: string;
  /** Flagged for geography-specific legal review before any go-live. */
  geographySensitive?: boolean;
};

export type Metro = {
  slug: string;
  label: string;
  /** Rough center for distance display later; not used for logic yet. */
  state: string;
};
