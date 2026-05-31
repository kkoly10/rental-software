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
  stopCount,
}: {
  routeId: string;
  currentStatus: string;
  /** Number of stops on this route — required for the no-stops guard.
      The "Start Route" button is disabled when stopCount === 0 because
      dispatching an empty route makes no sense; "Complete Route" is
      also disabled in that case for symmetry. */
  stopCount: number;
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.routeControls;
  const [state, action, pending] = useActionState(updateRouteStatus, initial);

  // The state machine: planned → in_progress → completed.  Surface only
  // the next valid transition (one button at a time).
  const next =
    currentStatus === "planned"
      ? { status: "in_progress", label: t.startRoute, kind: "start" as const }
      : currentStatus === "in_progress"
        ? { status: "completed", label: t.completeRoute, kind: "complete" as const }
        : null;

  if (!next) return null;

  const noStops = stopCount === 0;
  const disabledReason = noStops ? t.noStopsHint : "";

  // "Complete Route" is terminal — stops can no longer be edited once
  // the route is completed.  Gate it behind window.confirm to prevent
  // accidental clicks (the original button looked identical to "Add
  // Stop" and we saw the Playwright test trip on that ambiguity).
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (next?.kind === "complete") {
      const ok = window.confirm(t.completeRouteConfirm);
      if (!ok) {
        e.preventDefault();
      }
    }
  }

  return (
    <form action={action} onSubmit={onSubmit}>
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="status" value={next.status} />
      <button
        type="submit"
        className={
          next.kind === "complete"
            ? "route-status-complete-btn"
            : "primary-btn"
        }
        disabled={pending || noStops}
        title={disabledReason || undefined}
      >
        {pending ? t.updating : next.label}
      </button>
      {noStops && (
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          {t.noStopsHint}
        </div>
      )}
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

  // Removing a stop unassigns the order from this route.  Cheap to undo
  // (re-add via the Add Stop form) but easy to click accidentally —
  // window.confirm is the simplest universal guard.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(t.removeStopConfirm);
    if (!ok) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={onSubmit} style={{ display: "inline" }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <input type="hidden" name="route_id" value={routeId} />
      <button
        type="submit"
        className="route-stop-remove-btn"
        disabled={pending}
      >
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
