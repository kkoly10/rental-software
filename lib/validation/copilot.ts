import { z } from "zod";

export const copilotRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be 2000 characters or fewer."),
  route: z
    .string()
    .trim()
    .max(120, "Route is too long.")
    .regex(/^\/(dashboard|crew)(?:[/?#].*)?$/, "Invalid route.")
    .optional()
    .transform((value) => value || "/dashboard"),
});

export type CopilotRequestInput = z.infer<typeof copilotRequestSchema>;
