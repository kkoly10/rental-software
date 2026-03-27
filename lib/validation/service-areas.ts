import { z } from "zod";
import {
  moneySchema,
  optionalText,
  requiredPostalCodeSchema,
  requiredText,
  uuidSchema,
} from "@/lib/validation/common";
import { normalizePostalCode } from "@/lib/service-areas/normalize";

function parsePostalCodes(value: string) {
  return value
    .split(/[\n,]/)
    .map((part) => normalizePostalCode(part))
    .filter(Boolean);
}

const postalCodesInputSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length <= 500, "Postal codes must be 500 characters or fewer.")
  .transform((value) => parsePostalCodes(value))
  .refine((value) => value.length > 0, "At least one postal code is required.")
  .refine((value) => value.length <= 50, "You can add up to 50 postal codes per service area.");

export const createServiceAreaSchema = z.object({
  label: requiredText("Service area label", 100),
  primaryPostalCode: requiredPostalCodeSchema.transform((value) => normalizePostalCode(value)),
  postalCodesInput: postalCodesInputSchema,
  city: optionalText("City", 80),
  state: optionalText("State", 40).transform((value) => value?.toUpperCase()),
  deliveryFee: moneySchema("Delivery fee", { min: 0, max: 5000 }),
  minimumOrderAmount: moneySchema("Minimum order amount", { min: 0, max: 10000 }),
  isActive: z.boolean(),
});

export const updateServiceAreaSchema = createServiceAreaSchema.extend({
  serviceAreaId: uuidSchema,
});

export const archiveServiceAreaSchema = z.object({
  serviceAreaId: uuidSchema,
});
