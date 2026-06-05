import { z } from "zod";
import { moneySchema, optionalDateSchema, optionalText, uuidSchema } from "@/lib/validation/common";

export const paymentKindSchema = z.enum(["deposit", "balance", "partial", "refund"]);
export const paymentMethodSchema = z.enum(["cash", "check", "card_manual", "venmo", "zelle", "other"]);

// Channel that initiated the recording. Defaults to the dashboard form;
// "copilot" is set when the AI Operator Copilot records on the operator's
// behalf, so the audit log can attribute it. New channels can be added here.
export const paymentSourceSchema = z.enum(["dashboard", "copilot"]);

export const recordPaymentSchema = z.object({
  orderId: uuidSchema,
  amount: moneySchema("Payment amount", { min: 0.01, max: 100000 }),
  paymentType: paymentKindSchema.default("deposit"),
  paymentMethod: paymentMethodSchema.default("cash"),
  referenceNote: optionalText("Reference note", 120),
  paidAt: optionalDateSchema,
  source: paymentSourceSchema.default("dashboard"),
  // Optional dedupe key — Copilot generates a UUID per action block so a
  // double-click or HTTP retry resolves to the same payment row instead
  // of two. Manual dashboard entry leaves it unset (null on the row).
  idempotencyKey: z.string().uuid().optional(),
});
