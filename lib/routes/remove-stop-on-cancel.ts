import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-remove an order's route stop when the order is cancelled.
 * Cleans up the zombie-route follow-on if that was the last stop.
 *
 * Applies in both auto AND manual mode — keeping a stop for a non-
 * event is bookkeeping garbage either way, and the count-vs-list
 * mismatch it creates (the route detail view filters cancelled-order
 * stops out at render time, but the count stays inflated) is a real
 * UX bug regardless of routing philosophy.
 *
 * Idempotent: a no-op when the order isn't on any route.
 *
 * Atomicity: delegates to the `remove_order_stop_on_cancel` Postgres
 * RPC, which takes `FOR UPDATE` on the parent route so a concurrent
 * `auto_attach` can't race a new stop into a route we're about to
 * delete. See `supabase/migrations/20260603_030000_remove_order_stop_on_cancel_rpc.sql`.
 *
 * Never throws — failures are returned for the caller to log. We do
 * NOT want a cancellation flow to block on this cleanup; the order is
 * already cancelled at the time we run.
 */
export async function removeOrderStopOnCancel(
  organizationId: string,
  orderId: string,
  supabase: SupabaseClient,
): Promise<
  | { ok: true; removed: boolean; routeDeleted: boolean; routeId: string | null }
  | { ok: false; reason: string; detail?: string }
> {
  try {
    const { data, error } = await supabase
      .rpc("remove_order_stop_on_cancel", {
        p_order_id: orderId,
        p_org_id: organizationId,
      })
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "rpc_failed", detail: error.message };
    }

    const row = data as
      | {
          ok: boolean;
          reason: string | null;
          removed: boolean;
          route_deleted: boolean;
          route_id: string | null;
        }
      | null;

    if (!row) {
      return { ok: false, reason: "rpc_empty" };
    }

    if (!row.ok) {
      return { ok: false, reason: row.reason ?? "unknown" };
    }

    return {
      ok: true,
      removed: row.removed,
      routeDeleted: row.route_deleted,
      routeId: row.route_id,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "exception",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
