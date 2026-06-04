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
};

// Operational action (Phase 3): record a manual payment against an order.
// Delegates to the fully-guarded recordPayment server action.
export type CopilotPaymentAction = {
  type: "record_payment";
  preview: string;
  params: CopilotPaymentParams;
};

export type CopilotAction = CopilotContentAction | CopilotPaymentAction;

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
  const formData = new FormData();
  formData.set("order_id", action.params.orderId);
  formData.set("amount", String(action.params.amount));
  formData.set("payment_type", action.params.paymentType);
  formData.set("payment_method", action.params.paymentMethod);
  if (action.params.referenceNote) {
    formData.set("reference_note", action.params.referenceNote);
  }

  const result = await recordPayment({ ok: false, message: "" }, formData);
  return { ok: result.ok, message: result.message };
}

export async function executeCopilotAction(
  action: CopilotAction
): Promise<{ ok: boolean; message: string }> {
  if (action.type === "record_payment") {
    return executePaymentAction(action);
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
