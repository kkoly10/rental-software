"use client";

import { useActionState } from "react";
import {
  updateRouteStatus,
  updateStopStatus,
  removeStopFromRoute,
  type RouteActionState,
} from "@/lib/routes/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: RouteActionState = { ok: false, message: "" };

export function RouteStatusControls({
  routeId,
  currentStatus,
}: {
  routeId: string;
  currentStatus: string;
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.routeControls;
  const [state, action, pending] = useActionState(updateRouteStatus, initial);

  const next =
    currentStatus === "planned"
      ? { status: "in_progress", label: t.startRoute }
      : currentStatus === "in_progress"
        ? { status: "completed", label: t.completeRoute }
        : null;

  if (!next) return null;

  return (
    <form action={action}>
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="status" value={next.status} />
      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? t.updating : next.label}
      </button>
      {state.message && !state.ok && (
        <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function StopStatusButton({
  stopId,
  routeId,
  orderId,
  currentStatus,
}: {
  stopId: string;
  routeId: string;
  orderId?: string;
  currentStatus: string;
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.routeControls;
  const [state, action, pending] = useActionState(updateStopStatus, initial);

  if (currentStatus === "completed") {
    return <span className="badge success">{t.done}</span>;
  }

  const nextStatus =
    currentStatus === "assigned" ? "en_route"
    : currentStatus === "en_route" || currentStatus === "in_progress" ? "completed"
    : "completed";
  const label =
    currentStatus === "assigned" ? t.markEnRoute
    : t.markDelivered;

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="status" value={nextStatus} />
      {orderId && <input type="hidden" name="order_id" value={orderId} />}
      <button type="submit" className="ghost-btn" disabled={pending} style={{ fontSize: 13 }}>
        {pending ? "…" : label}
      </button>
      {state.message && !state.ok && (
        <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function RemoveStopButton({
  stopId,
  routeId,
}: {
  stopId: string;
  routeId: string;
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.routeControls;
  const [state, action, pending] = useActionState(removeStopFromRoute, initial);

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <input type="hidden" name="route_id" value={routeId} />
      <button type="submit" className="ghost-btn" disabled={pending} style={{ fontSize: 12, color: "var(--text-soft)" }}>
        {pending ? "…" : t.remove}
      </button>
      {state.message && !state.ok && (
        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--danger, #e53e3e)" }}>
          {state.message}
        </span>
      )}
    </form>
  );
}
