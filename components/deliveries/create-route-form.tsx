"use client";

import { useActionState } from "react";
import { createRoute, type RouteActionState } from "@/lib/routes/actions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const initial: RouteActionState = { ok: false, message: "" };

export function CreateRouteForm({
  teamMembers,
  defaultDate,
}: {
  teamMembers: { id: string; name: string }[];
  defaultDate?: string;
}) {
  const [state, action, pending] = useActionState(createRoute, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.routeId) {
      router.push(`/dashboard/deliveries/${state.routeId}`);
    }
  }, [state.ok, state.routeId, router]);

  return (
    <form action={action} className="list" style={{ marginTop: 12 }}>
      <div className="grid grid-2">
        <label className="order-card">
          <strong>Route name</strong>
          <input
            name="name"
            type="text"
            placeholder="e.g. Crew A Morning Route"
            style={{ marginTop: 8, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>Date</strong>
          <input
            name="route_date"
            type="date"
            required
            defaultValue={defaultDate}
            style={{ marginTop: 8, width: "100%" }}
          />
        </label>
      </div>

      <div className="grid grid-2">
        <label className="order-card">
          <strong>Driver / crew</strong>
          <select name="driver_profile_id" style={{ marginTop: 8, width: "100%" }}>
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>Vehicle</strong>
          <input
            name="assigned_vehicle"
            type="text"
            placeholder="e.g. Truck 1 · Trailer"
            style={{ marginTop: 8, width: "100%" }}
          />
        </label>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" role="alert" style={{ padding: "8px 12px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Creating..." : "Create Route"}
        </button>
      </div>
    </form>
  );
}
