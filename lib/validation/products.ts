import { z } from "zod";
import {
  moneySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "@/lib/validation/common";

export const productVisibilitySchema = z.enum(["public", "unlisted", "hidden"]);

// Sprint 6.0 — inflatable-vertical optional fields. Pinned literal
// values match the CHECK constraints in
// 20260605_010000_inflatable_setup.sql. Widening the lists requires a
// migration + a coordinated update here.
export const inflatableModeSchema = z.enum(["dry", "wet"]);
export const anchoringMethodSchema = z.enum([
  "stakes",
  "sandbags",
  "water_barrels",
  "concrete_weights",
  "tie_downs",
]);

const inflatableSetupShape = {
  supportsModes: z
    .array(inflatableModeSchema)
    .min(1, "At least one mode must be available.")
    .default(["dry"]),
  // Stored as cents in the DB; the form posts dollars and we convert
  // in the server action. Cap at $500/day so an operator can't fat-
  // finger a $5000 wet upcharge.
  wetUpcharge: moneySchema("Wet upcharge", { min: 0, max: 500 }).optional(),
  anchoringMethods: z.array(anchoringMethodSchema).default([]),
  requiredAnchorCount: z
    .number()
    .int()
    .min(0, "Anchor count cannot be negative.")
    .max(64, "Anchor counts above 64 are likely a typo.")
    .optional(),
};

/**
 * Phase 2e.1 — capability assignment. The product form posts
 * capability_slugs[] as a string array; the action validates each
 * against the registered capability registry before writing. Unknown
 * slugs are dropped silently (forward-compat: a removed capability
 * shouldn't crash a save on an old product row).
 *
 * Schema accepts any string array here so the validation passes
 * regardless; the actual slug filtering happens in the action so it
 * can reference the runtime registry without a circular import via
 * the validation layer.
 */
const capabilitySlugsShape = {
  capabilitySlugs: z
    .array(z.string().min(1).max(64))
    .max(32, "A product can declare at most 32 capabilities.")
    .default([]),
};

/**
 * Phase 2e.3 — per-hour pricing fields. Posted in dollars by the
 * form; the action multiplies by 100 to land cents in the DB
 * columns added by migration 20260608_030000_per_hour_pricing.sql.
 * All three are optional — they only matter when the product
 * declares the pricing.per-hour capability.
 */
const perHourShape = {
  hourlyRate: moneySchema("Hourly rate", { min: 0, max: 5000 }).optional(),
  minimumHours: z
    .number()
    .int()
    .min(0, "Minimum hours cannot be negative.")
    .max(24, "Minimum hours above 24 are likely a typo.")
    .optional(),
  idleHourRate: moneySchema("Idle hour rate", { min: 0, max: 5000 }).optional(),
};

/**
 * Phase 2e.4 — per-unit pricing fields. Posted in dollars by the
 * form; the action multiplies by 100 for the cents DB column added
 * by migration 20260608_040000_per_unit_pricing.sql. unit_label is
 * the singular display string ("chair", "section", "table") with a
 * 32-char DB CHECK upper bound.
 */
const perUnitShape = {
  unitPrice: moneySchema("Unit price", { min: 0, max: 5000 }).optional(),
  // readPerUnitFields posts `undefined` for a blank input (not "")
  // so we need .optional() outside optionalText — which starts with
  // z.string() and otherwise rejects undefined with "Required".
  unitLabel: optionalText("Unit label", 32).optional(),
};

/**
 * Phase 2e.5 — setup-window, onsite-attendant, capacity-calculator,
 * order-minimum. All are integer / enum / money fields gated by
 * their respective capability_slug at save time.
 */
export const capacityMetricSchema = z.enum([
  "guests",
  "sq_ft",
  "dancers",
  "servings",
]);

const setupWindowShape = {
  setupMinutesBefore: z
    .number()
    .int()
    .min(0, "Setup minutes cannot be negative.")
    .max(24 * 60, "Setup minutes above 24 hours are likely a typo.")
    .optional(),
};

const onsiteAttendantShape = {
  attendantIncludedHours: z
    .number()
    .int()
    .min(0, "Included hours cannot be negative.")
    .max(24, "Included hours above 24 are likely a typo.")
    .optional(),
  attendantOverageRate: moneySchema("Attendant overage rate", {
    min: 0,
    max: 5000,
  }).optional(),
};

const capacityCalculatorShape = {
  capacityMetric: capacityMetricSchema.optional(),
  capacityValue: z
    .number()
    .int()
    .min(0, "Capacity value cannot be negative.")
    .max(100000, "Capacity values above 100,000 are likely a typo.")
    .optional(),
};

const orderMinimumShape = {
  minimumOrderQuantity: z
    .number()
    .int()
    .min(0, "Minimum order quantity cannot be negative.")
    .max(100000, "Minimum order quantity above 100,000 is likely a typo.")
    .optional(),
};

export const createProductSchema = z.object({
  name: requiredText("Product name", 120),
  categoryId: z.string().trim().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  basePrice: moneySchema("Base price", { min: 0, max: 50000 }),
  securityDeposit: moneySchema("Security deposit", { min: 0, max: 50000 }),
  shortDescription: optionalText("Short description", 180),
  description: optionalText("Description", 5000),
  requiresDelivery: z.boolean(),
  isActive: z.boolean(),
  visibility: productVisibilitySchema.default("public"),
  ...inflatableSetupShape,
  ...capabilitySlugsShape,
  ...perHourShape,
  ...perUnitShape,
  ...setupWindowShape,
  ...onsiteAttendantShape,
  ...capacityCalculatorShape,
  ...orderMinimumShape,
});

export const updateProductSchema = createProductSchema.extend({
  productId: uuidSchema,
});
