import { z } from "zod";

export const clientErrorReportSchema = z.object({
  source: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1000),
  route: z.string().trim().max(200).optional(),
  stack: z.string().trim().max(5000).optional(),
  digest: z.string().trim().max(200).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

export type ClientErrorReportInput = z.infer<typeof clientErrorReportSchema>;
