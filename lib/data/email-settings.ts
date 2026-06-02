import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

/**
 * Per-org operator-facing email notification preferences. Mirrors the
 * existing `SmsSettings` shape stored in `organizations.settings.email_settings`.
 *
 * Defaults are conservative — opt-in for everything so existing orgs
 * see no change in behaviour after this PR ships.
 */
export type EmailSettings = {
  paymentReceived: boolean;
  refundProcessed: boolean;
  documentSigned: boolean;
  quoteAccepted: boolean;
  orderCancelled: boolean;
  portalMessage: boolean;
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  paymentReceived: true,
  refundProcessed: true,
  documentSigned: true,
  quoteAccepted: true,
  orderCancelled: true,
  portalMessage: true,
};

export async function getEmailSettings(organizationId?: string): Promise<EmailSettings> {
  if (!hasSupabaseEnv()) {
    return DEFAULT_EMAIL_SETTINGS;
  }

  let orgId = organizationId;
  if (!orgId) {
    const ctx = await getOrgContext();
    if (!ctx) return DEFAULT_EMAIL_SETTINGS;
    orgId = ctx.organizationId;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return DEFAULT_EMAIL_SETTINGS;

  const settings = (data.settings as Record<string, unknown>) ?? {};
  const email = (settings.email_settings as Record<string, unknown>) ?? {};

  return {
    paymentReceived:
      (email.payment_received as boolean) ?? DEFAULT_EMAIL_SETTINGS.paymentReceived,
    refundProcessed:
      (email.refund_processed as boolean) ?? DEFAULT_EMAIL_SETTINGS.refundProcessed,
    documentSigned:
      (email.document_signed as boolean) ?? DEFAULT_EMAIL_SETTINGS.documentSigned,
    quoteAccepted:
      (email.quote_accepted as boolean) ?? DEFAULT_EMAIL_SETTINGS.quoteAccepted,
    orderCancelled:
      (email.order_cancelled as boolean) ?? DEFAULT_EMAIL_SETTINGS.orderCancelled,
    portalMessage:
      (email.portal_message as boolean) ?? DEFAULT_EMAIL_SETTINGS.portalMessage,
  };
}
