import { z } from "zod";

// Prior conversation turns, sent by the client so the assistant can follow
// up coherently. Bounded in count and size to cap token cost and abuse.
const copilotHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const COPILOT_HISTORY_LIMIT = 10;

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
  history: z
    .array(copilotHistoryMessageSchema)
    .max(COPILOT_HISTORY_LIMIT, "Too many history messages.")
    .optional()
    .transform((value) => value ?? []),
});

export type CopilotHistoryMessage = z.infer<typeof copilotHistoryMessageSchema>;
export type CopilotRequestInput = z.infer<typeof copilotRequestSchema>;
