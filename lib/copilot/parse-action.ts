import type {
  CopilotAction,
  CopilotPaymentMethod,
  CopilotPaymentType,
} from "@/lib/copilot/actions";

const PAYMENT_TYPES: CopilotPaymentType[] = ["deposit", "balance", "partial"];
const PAYMENT_METHODS: CopilotPaymentMethod[] = [
  "cash",
  "check",
  "card_manual",
  "venmo",
  "zelle",
  "other",
];

function parsePaymentAction(parsed: Record<string, unknown>): CopilotAction | null {
  const params = parsed.params;
  if (typeof params !== "object" || params === null) return null;

  const p = params as Record<string, unknown>;
  const orderId = typeof p.orderId === "string" ? p.orderId : "";
  const amount = typeof p.amount === "number" ? p.amount : Number(p.amount);
  const paymentType = p.paymentType as CopilotPaymentType;
  const paymentMethod = p.paymentMethod as CopilotPaymentMethod;

  // Reject anything malformed here so we never render a preview for an action
  // the server is guaranteed to reject. The server re-validates regardless.
  if (!orderId) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!PAYMENT_TYPES.includes(paymentType)) return null;
  if (!PAYMENT_METHODS.includes(paymentMethod)) return null;

  return {
    type: "record_payment",
    preview: typeof parsed.preview === "string" ? parsed.preview : "",
    params: {
      orderId,
      amount,
      paymentType,
      paymentMethod,
      referenceNote:
        typeof p.referenceNote === "string" && p.referenceNote.trim()
          ? p.referenceNote
          : undefined,
    },
  };
}

/**
 * Parse a `[ACTION:{...}]` block out of an assistant reply. Returns the reply
 * text with the block removed, plus the parsed action if one was found and is
 * well-formed. Supports website-content actions and record_payment actions.
 */
export function parseActionFromResponse(content: string): {
  text: string;
  action: CopilotAction | null;
} {
  const actionRegex = /\[ACTION:\s*(\{[\s\S]*?\})\s*\]/;
  const match = content.match(actionRegex);

  if (!match) {
    return { text: content, action: null };
  }

  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    let action: CopilotAction | null = null;

    if (parsed.type === "record_payment") {
      action = parsePaymentAction(parsed);
    } else if (parsed.type && parsed.field && parsed.value) {
      action = {
        type: parsed.type as CopilotAction["type"],
        field: String(parsed.field),
        value: String(parsed.value),
        preview: typeof parsed.preview === "string" ? parsed.preview : "",
      } as CopilotAction;
    }

    if (action) {
      const text = content.replace(actionRegex, "").trim();
      return { text, action };
    }
  } catch {
    // JSON parse failed, treat as normal text
  }

  return { text: content, action: null };
}
