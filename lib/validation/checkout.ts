import { z } from "zod";
import {
  optionalDateSchema,
  optionalPhoneSchema,
  optionalSlugSchema,
  personNameSchema,
  requiredEmailSchema,
  requiredPostalCodeSchema,
  requiredText,
} from "@/lib/validation/common";

// Optional time in HH:MM format (24h)
const optionalTimeSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || /^\d{2}:\d{2}$/.test(val), {
    message: "Time must be in HH:MM format.",
  })
  .transform((val) => (val === "" ? undefined : val))
  .optional();

export const checkoutOrderSchema = z.object({
  firstName: personNameSchema("First name"),
  lastName: personNameSchema("Last name"),
  email: requiredEmailSchema,
  phone: optionalPhoneSchema,
  line1: requiredText("Address line 1", 120),
  city: requiredText("City", 80),
  state: requiredText("State", 80),
  postalCode: requiredPostalCodeSchema,
  eventDate: optionalDateSchema,
  startTime: optionalTimeSchema,
  endTime: optionalTimeSchema,
  productSlug: optionalSlugSchema,
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
