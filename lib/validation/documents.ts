import { z } from "zod";
import { uuidSchema } from "@/lib/validation/common";

export const documentStatusSchema = z.enum(["pending", "sent", "signed", "void"]);

export const updateDocumentStatusSchema = z.object({
  documentId: uuidSchema,
  newStatus: documentStatusSchema,
});

export const createOrderDocumentsSchema = z.object({
  orderId: uuidSchema,
});
