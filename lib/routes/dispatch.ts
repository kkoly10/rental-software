"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type DispatchActionState = {
  ok: boolean;
  message: string;
  routeId?: string;
};

/**
 * Sprint 1.5 — one-click dispatch from the order detail page.
 *
 * Hits the `dispatch_order_delivery` RPC which atomically:
 *   - flips the order's route stop to `en_route`
 *   - flips the parent route to `in_progress` (idempotent)
 *   - flips the order to `out_for_delivery`
 *
 * See supabase/migrations/20260603_020000_dispatch_order_delivery_rpc.sql
 * for the SQL contract.
 *
 * Surfaces a friendly message for each documented failure reason so
 * the operator sees why the button didn't work — most commonly
 * `not_found` (order has no route stop yet — operator needs to either
 * be in auto mode or attach manually first) and `already_dispatched`
 * (someone else just hit the button).
 */
export async function dispatchOrderDelivery(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Delivery would be dispatched." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) {
    return { ok: false, message: "Missing order id." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("dispatch_order_delivery", {
      p_order_id: orderId,
      p_org_id: ctx.organizationId,
      p_user_id: ctx.userId,
    })
    .maybeSingle();

  if (error) {
    console.error("[routes.dispatch] RPC failed:", error.message);
    return { ok: false, message: "Couldn't dispatch this delivery." };
  }

  const row = data as
    | {
        ok: boolean;
        reason: string | null;
        stop_id: string | null;
        route_id: string | null;
      }
    | null;

  if (!row) {
    return { ok: false, message: "Couldn't dispatch this delivery." };
  }

  if (!row.ok) {
    const message = (() => {
      switch (row.reason) {
        case "not_authorized":
          return "Only dispatchers and above can dispatch deliveries.";
        case "not_found":
          return "This order isn't on a route yet. Attach it to a route first.";
        case "already_dispatched":
          return "This delivery is already underway.";
        case "already_completed":
          return "This delivery has already been completed.";
        case "invalid_state":
          return "This stop is in a state that can't be dispatched. Refresh and try again.";
        default:
          return "Couldn't dispatch this delivery.";
      }
    })();
    return { ok: false, message };
  }

  // Mirror the legacy updateStopStatus path: issue a tracking token
  // and SMS the customer that the delivery is en route. Best-effort —
  // the dispatch itself has already succeeded.
  if (row.stop_id) {
    const { fireEnRouteSms } = await import("@/lib/routes/send-en-route-sms");
    await fireEnRouteSms(supabase, ctx.organizationId, row.stop_id);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/deliveries");
  if (row.route_id) {
    revalidatePath(`/dashboard/deliveries/${row.route_id}`);
  }

  return {
    ok: true,
    message: "Delivery is on the way.",
    routeId: row.route_id ?? undefined,
  };
}
