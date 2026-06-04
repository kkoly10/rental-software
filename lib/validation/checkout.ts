import { z } from "zod";
import {
  optionalDateSchema,
  optionalPhoneSchema,
  optionalSlugSchema,
  personNameSchema,
  requiredEmailSchema,
  requiredPostalCodeSchema,
} from "@/lib/validation/common";

// Optional time in HH:MM format (24h), validates actual hour/minute ranges
const optionalTimeSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (val === "") return true;
      if (!/^\d{2}:\d{2}$/.test(val)) return false;
      const [h, m] = val.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    },
    { message: "Time must be in HH:MM format (00:00–23:59)." }
  )
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
  postalCode: z.union([requiredPostalCodeSchema, z.literal("")]).optional().default(""),
  eventDate: optionalDateSchema,
  startTime: optionalTimeSchema,
  endTime: optionalTimeSchema,
  productSlug: optionalSlugSchema,
  fulfillmentType: z.enum(["delivery", "pickup"]).optional().default("delivery"),
  rentalEndDate: optionalDateSchema,
  // Client-generated nonce; used to deduplicate browser/network retries
  // of the same submission. UUID v4 from the browser; missing for older
  // clients (server falls back to non-idempotent behavior).
  idempotencyKey: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9_\-]+$/, { message: "Invalid idempotency key." })
    .optional()
    .default(""),
  // Sprint 6.0 — wet/dry choice the customer made on the product
  // detail page. Empty string normalises to undefined; invalid values
  // are dropped silently so a crafted POST can't bill the customer
  // extra. The action re-verifies against the product's
  // supports_modes before applying any upcharge.
  selectedMode: z
    .string()
    .trim()
    .transform((v) => (v === "dry" || v === "wet" ? v : ""))
    .optional()
    .default(""),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
