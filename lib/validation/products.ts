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
});

export const updateProductSchema = createProductSchema.extend({
  productId: uuidSchema,
});
