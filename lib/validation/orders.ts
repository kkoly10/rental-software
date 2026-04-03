import { z } from "zod";
import {
  moneySchema,
  optionalDateSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalText,
  personNameSchema,
  uuidSchema,
} from "@/lib/validation/common";

const optionalUuidSchema = z
  .string()
  .trim()
  .uuid("Invalid identifier.")
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

// Optional time in HH:MM format (24h)
const optionalTimeSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || /^\d{2}:\d{2}$/.test(val), {
    message: "Time must be in HH:MM format.",
  })
  .transform((val) => (val === "" ? undefined : val))
  .optional();

export const orderStatusSchema = z.enum([
  "inquiry",
  "quote_sent",
  "awaiting_deposit",
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
]);

export const createOrderSchema = z
  .object({
    firstName: personNameSchema("First name"),
    lastName: personNameSchema("Last name"),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    eventDate: optionalDateSchema,
    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    orderStatus: orderStatusSchema.default("inquiry"),
    productId: optionalUuidSchema,
    serviceAreaId: optionalUuidSchema,
    subtotal: moneySchema("Subtotal"),
    deliveryFee: moneySchema("Delivery fee"),
    depositAmount: moneySchema("Deposit amount"),
    notes: optionalText("Notes", 2000),
  })
  .superRefine(({ subtotal, deliveryFee, depositAmount }, ctx) => {
    const total = subtotal + deliveryFee;
    if (depositAmount > total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depositAmount"],
        message: "Deposit amount cannot be greater than the order total.",
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  orderId: uuidSchema,
  newStatus: orderStatusSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;