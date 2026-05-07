"use client";

import { useActionState } from "react";
import { addOrderToRoute, type RouteActionState } from "@/lib/routes/actions";
import type { UnroutedOrder } from "@/lib/data/unrouted-orders";

const initial: RouteActionState = { ok: false, message: "" };

export function AddStopForm({
  routeId,
  routeDate,
  unroutedOrders,
}: {
  routeId: string;
  routeDate: string;
  unroutedOrders: UnroutedOrder[];
}) {
  const [state, action, pending] = useActionState(addOrderToRoute, initial);

  if (unroutedOrders.length === 0) {
    return (
      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        No confirmed orders without a route for this date.
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="route_date" value={routeDate} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 180px" }}>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Order
          </label>
          <select name="order_id" required style={{ width: "100%" }}>
            <option value="">Select order…</option>
            {unroutedOrders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.orderNumber} — {o.customerName} ({o.productName})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Type
          </label>
          <select name="stop_type" style={{ width: "100%" }}>
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
          </select>
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Time (optional)
          </label>
          <input name="scheduled_time" type="time" style={{ width: "100%" }} />
        </div>

        <button type="submit" className="secondary-btn" disabled={pending} style={{ flexShrink: 0 }}>
          {pending ? "Adding…" : "Add Stop"}
        </button>
      </div>

      {state.message && (
        <div
          className={`badge ${state.ok ? "success" : "warning"}`}
          style={{ marginTop: 8, padding: "6px 10px", fontSize: 13 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
