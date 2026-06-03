import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

/**
 * Sprint 5.5 — fetch the before/after photo pair(s) for a given order.
 *
 * One order can produce 1-2 stops (1 delivery + maybe 1 pickup). We
 * return them as a small array so the operator's Equipment Condition
 * card can render a row per stop with both photos side-by-side.
 *
 * The customer portal calls the same function (via a portal-token
 * authenticated wrapper in `lib/data/portal-condition.ts`) so both
 * the operator-facing and the customer-facing views render the same
 * data — the strategic framing depends on transparency.
 */
export type ConditionRow = {
  stopId: string;
  stopType: "delivery" | "pickup";
  sequence: number;
  deliveryPhotoUrl: string | null;
  deliverySignature: string | null;
  pickupPhotoUrl: string | null;
  pickupSignature: string | null;
};

export async function getOrderConditionRows(
  orderId: string,
): Promise<ConditionRow[]> {
  if (!hasSupabaseEnv()) return [];
  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, proof_photo_url, signature_name, pickup_photo_url, pickup_signature_name, routes!inner(organization_id)",
    )
    .eq("order_id", orderId)
    .eq("routes.organization_id", ctx.organizationId)
    .order("stop_sequence", { ascending: true });

  return mapRows(data ?? []);
}

/**
 * Customer-portal variant of `getOrderConditionRows`. Caller supplies
 * the supabase client (typically the admin client used elsewhere in
 * the portal flow) plus the org id and order id resolved from the
 * portal token. We don't rely on `getOrgContext` because the customer
 * isn't authenticated — the portal token is the trust anchor.
 *
 * Returns the same `ConditionRow[]` shape so the EquipmentConditionCard
 * component renders identically for operator and customer views.
 */
export async function getOrderConditionRowsForPortal(
  supabase: SupabaseClient,
  organizationId: string,
  orderId: string,
): Promise<ConditionRow[]> {
  const { data } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, proof_photo_url, signature_name, pickup_photo_url, pickup_signature_name, routes!inner(organization_id)",
    )
    .eq("order_id", orderId)
    .eq("routes.organization_id", organizationId)
    .order("stop_sequence", { ascending: true });
  return mapRows(data ?? []);
}

function mapRows(data: Record<string, unknown>[]): ConditionRow[] {
  return data.map((row) => ({
    stopId: row.id as string,
    stopType: ((row.stop_type as string | null) ?? "delivery") as
      | "delivery"
      | "pickup",
    sequence: Number(row.stop_sequence ?? 0),
    deliveryPhotoUrl: (row.proof_photo_url as string | null) ?? null,
    deliverySignature: (row.signature_name as string | null) ?? null,
    pickupPhotoUrl: (row.pickup_photo_url as string | null) ?? null,
    pickupSignature: (row.pickup_signature_name as string | null) ?? null,
  }));
}
