import { z } from "zod";
import {
  optionalDateSchema,
  optionalPhoneSchema,
  optionalSlugSchema,
  personNameSchema,
  requiredEmailSchema,
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
  // Address fields are optional here — the checkout action enforces them
  // when fulfillmentType === 'delivery'.
  line1: z.string().trim().max(120).optional().default(""),
  line2: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().optional().default(""),
  eventDate: optionalDateSchema,
  startTime: optionalTimeSchema,
  endTime: optionalTimeSchema,
  productSlug: optionalSlugSchema,
  fulfillmentType: z.enum(["delivery", "pickup"]).optional().default("delivery"),
  rentalEndDate: optionalDateSchema,
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
