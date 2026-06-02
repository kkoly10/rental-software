import { z } from "zod";
import {
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  personNameSchema,
  uuidSchema,
} from "@/lib/validation/common";

// Must match the CHECK constraint on customers.preferred_locale and the
// locales the i18n dictionaries actually support.
export const SUPPORTED_CUSTOMER_LOCALES = ["en", "fr", "es", "pt"] as const;
export type CustomerLocale = (typeof SUPPORTED_CUSTOMER_LOCALES)[number];

export const updateCustomerSchema = z.object({
  customerId: uuidSchema,
  firstName: personNameSchema("First name"),
  lastName: personNameSchema("Last name"),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  notes: optionalText("Notes", 2000),
  preferredLocale: z.enum(SUPPORTED_CUSTOMER_LOCALES).default("en"),
  addressLine1: optionalText("Street address", 200),
  addressLine2: optionalText("Apt / Suite / Unit", 100),
  addressCity: optionalText("City", 100),
  addressState: optionalText("State", 3),
  addressZip: optionalText("ZIP code", 10),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
