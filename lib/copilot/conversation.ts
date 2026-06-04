import type { CopilotHistoryMessage } from "@/lib/validation/copilot";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Combine prior turns with the new message into a valid conversation:
 * it must begin with a user turn and strictly alternate roles (Anthropic
 * rejects otherwise; OpenAI is lenient but the same shape is fine). Any
 * malformed history (leading assistant turn, repeated roles, a dangling
 * trailing user turn) is normalized away before the new user message is
 * appended.
 */
export function buildConversationMessages(
  history: CopilotHistoryMessage[],
  message: string
): ChatTurn[] {
  const cleaned: ChatTurn[] = [];
  for (const turn of history) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev) {
      // The conversation must open on a user turn.
      if (turn.role !== "user") continue;
    } else if (prev.role === turn.role) {
      // Skip repeated roles to keep the user/assistant alternation valid.
      continue;
    }
    cleaned.push({ role: turn.role, content: turn.content });
  }

  // The new message is a user turn, so drop a dangling trailing user turn.
  if (cleaned[cleaned.length - 1]?.role === "user") {
    cleaned.pop();
  }
  cleaned.push({ role: "user", content: message });
  return cleaned;
}
