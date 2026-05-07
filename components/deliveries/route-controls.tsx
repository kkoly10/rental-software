"use client";

import { useActionState } from "react";
import {
  updateRouteStatus,
  updateStopStatus,
  removeStopFromRoute,
  type RouteActionState,
} from "@/lib/routes/actions";

const initial: RouteActionState = { ok: false, message: "" };

export function RouteStatusControls({
  routeId,
  currentStatus,
}: {
  routeId: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState(updateRouteStatus, initial);

  const next =
    currentStatus === "planned"
      ? { status: "in_progress", label: "Start Route" }
      : currentStatus === "in_progress"
        ? { status: "completed", label: "Complete Route" }
        : null;

  if (!next) return null;

  return (
    <form action={action}>
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="status" value={next.status} />
      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? "Updating…" : next.label}
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
  const [state, action, pending] = useActionState(updateStopStatus, initial);

  if (currentStatus === "completed") {
    return <span className="badge success">Done</span>;
  }

  const nextStatus =
    currentStatus === "assigned" ? "en_route"
    : currentStatus === "en_route" || currentStatus === "in_progress" ? "completed"
    : "completed";
  const label =
    currentStatus === "assigned" ? "Mark En Route"
    : "Mark Delivered";

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
  const [, action, pending] = useActionState(removeStopFromRoute, initial);

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <input type="hidden" name="route_id" value={routeId} />
      <button type="submit" className="ghost-btn" disabled={pending} style={{ fontSize: 12, color: "var(--text-soft)" }}>
        {pending ? "…" : "Remove"}
      </button>
    </form>
  );
}
