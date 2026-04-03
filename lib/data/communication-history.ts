import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type CommunicationEntry = {
  id: string;
  channel: string;
  direction: string;
  recipient: string | null;
  subject: string | null;
  bodyPreview: string | null;
  status: string;
  createdAt: string;
  orderNumber?: string;
};

/**
 * Fetch all communication_log entries for a specific order.
 */
export async function getOrderCommunications(orderId: string): Promise<CommunicationEntry[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("communication_log")
    .select("id, channel, direction, recipient, subject, body_preview, status, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map(mapRow);
}

/**
 * Fetch all communication_log entries for a specific customer across all orders.
 */
export async function getCustomerCommunications(customerId: string): Promise<CommunicationEntry[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("communication_log")
    .select("id, channel, direction, recipient, subject, body_preview, status, created_at, orders(order_number)")
    .eq("organization_id", ctx.organizationId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => {
    const entry = mapRow(row);
    const order = (row as Record<string, unknown>).orders as { order_number?: string } | null;
    if (order?.order_number) {
      entry.orderNumber = order.order_number;
    }
    return entry;
  });
}

function mapRow(row: Record<string, unknown>): CommunicationEntry {
  return {
    id: String(row.id ?? ""),
    channel: String(row.channel ?? ""),
    direction: String(row.direction ?? ""),
    recipient: row.recipient ? String(row.recipient) : null,
    subject: row.subject ? String(row.subject) : null,
    bodyPreview: row.body_preview ? String(row.body_preview) : null,
    status: String(row.status ?? "sent"),
    createdAt: String(row.created_at ?? ""),
  };
}
