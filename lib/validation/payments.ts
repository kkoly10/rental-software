import { z } from "zod";
import { moneySchema, optionalDateSchema, optionalText, uuidSchema } from "@/lib/validation/common";

export const paymentKindSchema = z.enum(["deposit", "balance", "partial", "refund"]);
export const paymentMethodSchema = z.enum(["cash", "check", "card_manual", "venmo", "zelle", "other"]);

export const recordPaymentSchema = z.object({
  orderId: uuidSchema,
  amount: moneySchema("Payment amount", { min: 0.01, max: 100000 }),
  paymentType: paymentKindSchema.default("deposit"),
  paymentMethod: paymentMethodSchema.default("cash"),
  referenceNote: optionalText("Reference note", 120),
  paidAt: optionalDateSchema,
});
