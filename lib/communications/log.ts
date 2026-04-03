import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export type CommunicationLogEntry = {
  organizationId: string;
  orderId?: string | null;
  customerId?: string | null;
  channel: "email" | "sms" | "portal_message" | "system";
  direction: "outbound" | "inbound";
  recipient?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  status?: "sent" | "delivered" | "failed" | "bounced";
  metadata?: Record<string, unknown>;
};

/**
 * Log a communication event to the audit trail.
 * Non-blocking — failures are logged but never propagated.
 */
export async function logCommunication(entry: CommunicationLogEntry): Promise<void> {
  if (!hasSupabaseEnv()) return;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("communication_log").insert({
      organization_id: entry.organizationId,
      order_id: entry.orderId ?? null,
      customer_id: entry.customerId ?? null,
      channel: entry.channel,
      direction: entry.direction,
      recipient: entry.recipient ?? null,
      subject: entry.subject ?? null,
      body_preview: entry.bodyPreview ? entry.bodyPreview.slice(0, 200) : null,
      status: entry.status ?? "sent",
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.error("[communication_log] Failed to log:", err);
  }
}
