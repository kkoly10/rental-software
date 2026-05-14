import { z } from "zod";
import {
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  personNameSchema,
  uuidSchema,
} from "@/lib/validation/common";

export const updateCustomerSchema = z.object({
  customerId: uuidSchema,
  firstName: personNameSchema("First name"),
  lastName: personNameSchema("Last name"),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  notes: optionalText("Notes", 2000),
  addressLine1: optionalText("Street address", 200),
  addressLine2: optionalText("Apt / Suite / Unit", 100),
  addressCity: optionalText("City", 100),
  addressState: optionalText("State", 3),
  addressZip: optionalText("ZIP code", 10),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
