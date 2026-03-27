import { z } from "zod";
import {
  moneySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "@/lib/validation/common";

export const productVisibilitySchema = z.enum(["public", "unlisted", "hidden"]);

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
});

export const updateProductSchema = createProductSchema.extend({
  productId: uuidSchema,
});
