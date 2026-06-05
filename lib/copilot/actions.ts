import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { mergeOrgSettings } from "@/lib/settings/merge-settings";

export type CopilotContentActionType =
  | "update_hero"
  | "update_service_area_text"
  | "update_booking_message"
  | "update_faq"
  | "update_about"
  | "generate_content";

// Read/write of website content — the original Copilot action surface.
export type CopilotContentAction = {
  type: CopilotContentActionType;
  field: string;
  value: string;
  preview: string;
};

// Refunds are intentionally excluded from the Copilot surface — recording
// money *out* is the most error-sensitive operation, so it stays a manual
// flow on the Payments page. The Copilot only records incoming payments.
export type CopilotPaymentType = "deposit" | "balance" | "partial";
export type CopilotPaymentMethod =
  | "cash"
  | "check"
  | "card_manual"
  | "venmo"
  | "zelle"
  | "other";

export type CopilotPaymentParams = {
  orderId: string;
  amount: number;
  paymentType: CopilotPaymentType;
  paymentMethod: CopilotPaymentMethod;
  referenceNote?: string;
  // Generated client-side once per ACTION block; the server passes it
  // to record_manual_payment so retries land on the same payment row.
  idempotencyKey?: string;
  // Server-injected (chat route) so the preview can render the real
  // order_number + customer name instead of relying on the model's
  // preview string. Cross-checks the orderId against actual data
  // before the operator confirms.
  orderNumber?: string;
  customerName?: string;
};

// Operational action (Phase 3): record a manual payment against an order.
// Delegates to the fully-guarded recordPayment server action.
export type CopilotPaymentAction = {
  type: "record_payment";
  preview: string;
  params: CopilotPaymentParams;
};

// Forward/progress statuses the Copilot may set. `cancelled` and `refunded`
// are intentionally excluded — those are destructive/financial and stay manual
// (the underlying updateOrderStatus still enforces the full state machine).
export type CopilotOrderStatus =
  | "quote_sent"
  | "awaiting_deposit"
  | "confirmed"
  | "scheduled"
  | "out_for_delivery"
  | "delivered"
  | "completed";

export type CopilotOrderStatusParams = {
  orderId: string;
  newStatus: CopilotOrderStatus;
  // Server-injected (chat route) so the preview can label the order
  // by number + customer rather than relying on the model.
  orderNumber?: string;
  customerName?: string;
};

// Operational action: advance an order to a new status. Delegates to the
// fully-guarded updateOrderStatus server action (state machine + TOCTOU).
export type CopilotOrderStatusAction = {
  type: "update_order_status";
  preview: string;
  params: CopilotOrderStatusParams;
};

// Operational action: generate the rental agreement + safety waiver for an
// order (and email the customer to sign). Delegates to createDocumentsForOrder.
export type CopilotGenerateDocumentsAction = {
  type: "generate_documents";
  preview: string;
  params: { orderId: string };
};

// Operational action: send a quote for an inquiry/quote_sent order (emails the
// customer and moves the order to quote_sent). Delegates to sendQuote.
export type CopilotSendQuoteAction = {
  type: "send_quote";
  preview: string;
  params: { orderId: string };
};

// Operational action: send a drafted reply to a customer message. The most
// outward-facing action — it sends a real email. Delegates to sendReply.
export type CopilotSendReplyParams = {
  body: string;
  customerEmail: string;
  customerId?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
};

export type CopilotSendReplyAction = {
  type: "send_reply";
  preview: string;
  params: CopilotSendReplyParams;
};

export type CopilotAction =
  | CopilotContentAction
  | CopilotPaymentAction
  | CopilotOrderStatusAction
  | CopilotGenerateDocumentsAction
  | CopilotSendReplyAction
  | CopilotSendQuoteAction;

const ALLOWED_SETTINGS_FIELDS: Record<string, string> = {
  update_hero: "hero_message",
  update_service_area_text: "service_area_text",
  update_booking_message: "booking_message",
  update_faq: "custom_faq",
  update_about: "about_text",
};

async function executePaymentAction(
  action: CopilotPaymentAction
): Promise<{ ok: boolean; message: string }> {
  // Reuse the battle-tested payment action: it re-validates the payload,
  // enforces org-scoping, role (owner/admin/dispatcher), rate limits,
  // terminal-state guards, records atomically via RPC, writes an audit
  // log, auto-confirms, and fires customer notifications. We do not
  // duplicate any of that here.
  const { recordPayment } = await import("@/lib/payments/actions");
  const { buildCopilotPaymentReferenceNote } = await import(
    "@/lib/copilot/payment-note"
  );
  const formData = new FormData();
  formData.set("order_id", action.params.orderId);
  formData.set("amount", String(action.params.amount));
  formData.set("payment_type", action.params.paymentType);
  formData.set("payment_method", action.params.paymentMethod);
  // Always stamp the stored note with the Copilot attribution marker, plus the
  // operator's note if any. Deterministic + server-side so the mark can't be
  // omitted by the model. `source=copilot` is recorded in the audit log.
  formData.set(
    "reference_note",
    buildCopilotPaymentReferenceNote(action.params.referenceNote)
  );
  formData.set("source", "copilot");
  if (action.params.idempotencyKey) {
    formData.set("idempotency_key", action.params.idempotencyKey);
  }

  const result = await recordPayment({ ok: false, message: "" }, formData);
  return { ok: result.ok, message: result.message };
}

async function executeOrderStatusAction(
  action: CopilotOrderStatusAction
): Promise<{ ok: boolean; message: string }> {
  // Reuse updateOrderStatus: it enforces the VALID_TRANSITIONS state machine,
  // role, rate limits, TOCTOU, and side effects (inventory release, accounting
  // sync). The Copilot layer only ever proposes non-destructive forward statuses.
  const { updateOrderStatus } = await import("@/lib/orders/actions");
  const result = await updateOrderStatus(action.params.orderId, action.params.newStatus);
  return { ok: result.ok, message: result.message };
}

async function executeGenerateDocumentsAction(
  action: CopilotGenerateDocumentsAction
): Promise<{ ok: boolean; message: string }> {
  // Reuse createDocumentsForOrder: role check, duplicate guard, and the
  // customer "documents ready to sign" email all live there.
  const { createDocumentsForOrder } = await import("@/lib/documents/actions");
  const result = await createDocumentsForOrder(action.params.orderId);
  return { ok: result.ok, message: result.message };
}

async function executeSendReplyAction(
  action: CopilotSendReplyAction
): Promise<{ ok: boolean; message: string }> {
  // Reuse sendReply: rate limits, org-scope checks on customer/order, role
  // check, message insert, communication log, and the customer email all live
  // there. We just build the FormData it expects.
  const { sendReply } = await import("@/lib/messages/actions");
  const formData = new FormData();
  formData.set("body", action.params.body);
  formData.set("customer_email", action.params.customerEmail);
  if (action.params.customerId) formData.set("customer_id", action.params.customerId);
  if (action.params.orderId) formData.set("order_id", action.params.orderId);
  if (action.params.orderNumber) formData.set("order_number", action.params.orderNumber);

  const result = await sendReply({ ok: false, message: "" }, formData);
  return { ok: result.ok, message: result.message };
}

async function executeSendQuoteAction(
  action: CopilotSendQuoteAction
): Promise<{ ok: boolean; message: string }> {
  // Reuse sendQuote: role check, status guard (inquiry/quote_sent), the
  // quote_sent transition, and the quote email all live there.
  const { sendQuote } = await import("@/lib/quotes/actions");
  const result = await sendQuote(action.params.orderId);
  return { ok: result.ok, message: result.message };
}

export async function executeCopilotAction(
  action: CopilotAction
): Promise<{ ok: boolean; message: string }> {
  if (action.type === "record_payment") {
    return executePaymentAction(action);
  }
  if (action.type === "update_order_status") {
    return executeOrderStatusAction(action);
  }
  if (action.type === "generate_documents") {
    return executeGenerateDocumentsAction(action);
  }
  if (action.type === "send_reply") {
    return executeSendReplyAction(action);
  }
  if (action.type === "send_quote") {
    return executeSendQuoteAction(action);
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: ${action.preview || "Action would be applied."}`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const settingsKey =
    action.type === "generate_content"
      ? action.field
      : ALLOWED_SETTINGS_FIELDS[action.type];

  if (!settingsKey) {
    return { ok: false, message: `Unknown action type: ${action.type}` };
  }

  // For generate_content, validate the field is one we allow
  if (
    action.type === "generate_content" &&
    !Object.values(ALLOWED_SETTINGS_FIELDS).includes(settingsKey)
  ) {
    return { ok: false, message: `Cannot update field: ${action.field}` };
  }

  const supabase = await createSupabaseServerClient();

  const { data: copilotMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(copilotMembership?.role ?? "")) {
    return { ok: false, message: "Only owners and admins can apply AI suggestions." };
  }

  // Parse value for FAQ (expects JSON array)
  let parsedValue: unknown = action.value;
  if (settingsKey === "custom_faq") {
    try {
      parsedValue = JSON.parse(action.value);
      if (!Array.isArray(parsedValue)) {
        return {
          ok: false,
          message: "FAQ value must be a JSON array of {question, answer} items.",
        };
      }
    } catch {
      return {
        ok: false,
        message: "Invalid FAQ JSON format.",
      };
    }
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    [settingsKey]: parsedValue || null,
  });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  return {
    ok: true,
    message: action.preview || "Changes applied successfully.",
  };
}
