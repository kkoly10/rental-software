import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "../sms/provider.ts";
import { sendWhatsApp } from "./whatsapp-provider.ts";
import {
  buildVariables,
  getWhatsAppContentSid,
  type WhatsAppTemplateKey,
} from "./whatsapp-templates.ts";

/**
 * Unified customer-notification dispatch (Sprint 4).
 *
 * Decision tree:
 *
 *   1. Resolve the org's WhatsApp settings.
 *   2. If `whatsapp_enabled` AND the template has a ContentSid AND
 *      the customer is `whatsapp_opted_in`, try WhatsApp first.
 *   3. If WhatsApp send fails (or any precondition is false), fall
 *      back to SMS.
 *
 * The fall-back is automatic so a Meta-template-not-yet-approved
 * state doesn't black-hole customer messages. The trade-off: the
 * operator may not realize WhatsApp is failing until they check the
 * comm log. Sprint 4.5 will surface a per-template approval status
 * on the Settings page.
 *
 * Returns the channel that succeeded so callers (logCommunication)
 * can record which channel actually delivered.
 */
export type DispatchResult = {
  channel: "whatsapp" | "sms" | "none";
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function dispatchCustomerMessage(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    templateKey: WhatsAppTemplateKey;
    smsBody: string;
    phone: string;
    customerWhatsappOptedIn: boolean;
    customerWhatsappNumber: string | null;
    params: Record<string, string>;
  },
): Promise<DispatchResult> {
  // Try WhatsApp if all preconditions pass.
  const tryWhatsApp = await maybeSendWhatsApp(supabase, organizationId, input);
  if (tryWhatsApp.channel === "whatsapp" && tryWhatsApp.ok) {
    return tryWhatsApp;
  }

  // Fall back to SMS (also used when WhatsApp didn't try at all).
  const smsResult = await sendSms({ to: input.phone, body: input.smsBody });
  return {
    channel: smsResult.ok ? "sms" : "none",
    ok: smsResult.ok,
    messageId: smsResult.messageId,
    error: smsResult.error,
  };
}

async function maybeSendWhatsApp(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    templateKey: WhatsAppTemplateKey;
    phone: string;
    customerWhatsappOptedIn: boolean;
    customerWhatsappNumber: string | null;
    params: Record<string, string>;
  },
): Promise<DispatchResult> {
  if (!input.customerWhatsappOptedIn) {
    return { channel: "none", ok: false };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("whatsapp_enabled, whatsapp_sender_id")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const enabled = (org?.whatsapp_enabled as boolean | null) ?? false;
  const senderId = (org?.whatsapp_sender_id as string | null) ?? "";
  if (!enabled || !senderId) {
    return { channel: "none", ok: false };
  }

  const contentSid = getWhatsAppContentSid(input.templateKey);
  if (!contentSid) {
    // No approved template — bail and let SMS take over.
    // Operators don't always realise this is the path that fires when
    // a template is pending Meta approval, so log a single warning the
    // first time a given template falls through. They'll see SMS land
    // and wonder why WhatsApp didn't — Sentry now gives them the
    // answer: "WHATSAPP_TEMPLATE_X is unset on this deploy."
    console.warn(
      `[messaging] WhatsApp template "${input.templateKey}" has no ContentSid — falling back to SMS. org=${organizationId}`,
    );
    return { channel: "none", ok: false };
  }

  const targetNumber = (input.customerWhatsappNumber ?? input.phone).trim();
  if (!targetNumber) return { channel: "none", ok: false };

  const result = await sendWhatsApp(
    {
      to: targetNumber,
      contentSid,
      contentVariables: buildVariables(input.templateKey, input.params),
    },
    { senderId },
  );

  return {
    channel: "whatsapp",
    ok: result.ok,
    messageId: result.messageId,
    error: result.error,
  };
}
