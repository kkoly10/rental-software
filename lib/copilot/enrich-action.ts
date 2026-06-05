import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side enrichment for assistant responses that contain an
 * `[ACTION:{...}]` block referencing an orderId. Re-renders the ACTION
 * block with the actual `orderNumber` + `customerName` looked up from
 * Supabase, so the preview UI can show the real label and the operator
 * has a non-LLM cross-check on the order before confirming.
 *
 * No-ops when:
 * - there's no ACTION block
 * - the action type doesn't reference an orderId (content actions)
 * - the orderId doesn't resolve in the operator's org (the
 *   action is left alone — server-side execution will reject it)
 *
 * Pure string-in / string-out so the caller can swap in the result
 * before returning to the client.
 */
const ACTION_BLOCK_RE = /\[ACTION:\s*(\{[\s\S]*?\})\s*\]/;

const ORDER_ACTION_TYPES = new Set([
  "record_payment",
  "update_order_status",
  "generate_documents",
]);

export async function enrichActionInResponse(
  response: string,
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const match = response.match(ACTION_BLOCK_RE);
  if (!match) return response;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return response;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";
  if (!ORDER_ACTION_TYPES.has(type)) return response;

  const params = parsed.params as Record<string, unknown> | undefined;
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";
  if (!orderId) return response;

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, customers(first_name, last_name)")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return response;

  const customer = (order as { customers?: { first_name?: string | null; last_name?: string | null } | null })
    .customers;
  const customerName = customer
    ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
    : "";

  const enriched = {
    ...parsed,
    params: {
      ...(params ?? {}),
      orderNumber: order.order_number ?? undefined,
      ...(customerName ? { customerName } : {}),
    },
  };

  return response.replace(ACTION_BLOCK_RE, `[ACTION:${JSON.stringify(enriched)}]`);
}
