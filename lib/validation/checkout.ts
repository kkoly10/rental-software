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
  productSlug: optionalSlugSchema,
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
