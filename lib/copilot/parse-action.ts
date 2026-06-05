import type {
  CopilotAction,
  CopilotOrderStatus,
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

const ORDER_STATUSES: CopilotOrderStatus[] = [
  "quote_sent",
  "awaiting_deposit",
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
];

function parseOrderStatusAction(parsed: Record<string, unknown>): CopilotAction | null {
  const params = parsed.params;
  if (typeof params !== "object" || params === null) return null;
  const p = params as Record<string, unknown>;
  const orderId = typeof p.orderId === "string" ? p.orderId : "";
  const newStatus = p.newStatus as CopilotOrderStatus;

  if (!orderId) return null;
  if (!ORDER_STATUSES.includes(newStatus)) return null;

  return {
    type: "update_order_status",
    preview: typeof parsed.preview === "string" ? parsed.preview : "",
    params: { orderId, newStatus },
  };
}

function parseGenerateDocumentsAction(parsed: Record<string, unknown>): CopilotAction | null {
  const params = parsed.params;
  if (typeof params !== "object" || params === null) return null;
  const orderId =
    typeof (params as Record<string, unknown>).orderId === "string"
      ? ((params as Record<string, unknown>).orderId as string)
      : "";
  if (!orderId) return null;

  return {
    type: "generate_documents",
    preview: typeof parsed.preview === "string" ? parsed.preview : "",
    params: { orderId },
  };
}

function parseSendQuoteAction(parsed: Record<string, unknown>): CopilotAction | null {
  const params = parsed.params;
  if (typeof params !== "object" || params === null) return null;
  const orderId =
    typeof (params as Record<string, unknown>).orderId === "string"
      ? ((params as Record<string, unknown>).orderId as string)
      : "";
  if (!orderId) return null;

  return {
    type: "send_quote",
    preview: typeof parsed.preview === "string" ? parsed.preview : "",
    params: { orderId },
  };
}

function optionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function parseSendReplyAction(parsed: Record<string, unknown>): CopilotAction | null {
  const params = parsed.params;
  if (typeof params !== "object" || params === null) return null;
  const p = params as Record<string, unknown>;
  const body = typeof p.body === "string" ? p.body.trim() : "";
  const customerEmail = typeof p.customerEmail === "string" ? p.customerEmail.trim() : "";

  // Require a non-empty body and a plausible email; the server re-validates.
  if (!body) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) return null;

  return {
    type: "send_reply",
    preview: typeof parsed.preview === "string" ? parsed.preview : "",
    params: {
      body,
      customerEmail,
      customerId: optionalString(p.customerId) ?? null,
      orderId: optionalString(p.orderId) ?? null,
      orderNumber: optionalString(p.orderNumber) ?? null,
    },
  };
}

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
    } else if (parsed.type === "update_order_status") {
      action = parseOrderStatusAction(parsed);
    } else if (parsed.type === "generate_documents") {
      action = parseGenerateDocumentsAction(parsed);
    } else if (parsed.type === "send_reply") {
      action = parseSendReplyAction(parsed);
    } else if (parsed.type === "send_quote") {
      action = parseSendQuoteAction(parsed);
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
