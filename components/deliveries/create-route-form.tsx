"use client";

import { useActionState, useState } from "react";
import { createRoute, type RouteActionState } from "@/lib/routes/actions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";

const initial: RouteActionState = { ok: false, message: "" };

export function CreateRouteForm({
  teamMembers,
}: {
  teamMembers: { id: string; name: string }[];
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.createRoute;
  const [state, action, pending] = useActionState(createRoute, initial);
  const router = useRouter();
  // Compute today in the browser's local timezone to avoid UTC-date mismatch
  // that occurs when the server generates toISOString().slice(0, 10) at midnight.
  const [localToday] = useState(() => new Date().toLocaleDateString("en-CA"));

  useEffect(() => {
    if (state.ok && state.routeId) {
      router.push(`/dashboard/deliveries/${state.routeId}`);
    }
  }, [state.ok, state.routeId, router]);

  return (
    <form action={action} className="list" style={{ marginTop: 12 }}>
      <div className="grid grid-2">
        <label className="order-card">
          <strong>{t.routeNameLabel}</strong>
          <input
            name="name"
            type="text"
            placeholder={t.routeNamePlaceholder}
            style={{ marginTop: 8, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{t.dateLabel}</strong>
          <input
            name="route_date"
            type="date"
            required
            defaultValue={localToday}
            style={{ marginTop: 8, width: "100%" }}
          />
        </label>
      </div>

      <div className="grid grid-2">
        <label className="order-card">
          <strong>{t.driverLabel}</strong>
          <select name="driver_profile_id" style={{ marginTop: 8, width: "100%" }}>
            <option value="">{t.unassigned}</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>{t.vehicleLabel}</strong>
          <input
            name="assigned_vehicle"
            type="text"
            placeholder={t.vehiclePlaceholder}
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
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
