"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addOrderToRoute, type RouteActionState } from "@/lib/routes/actions";
import type { OrderRoutingState } from "@/lib/data/order-routing";
import { useI18n } from "@/lib/i18n/provider";

const initial: RouteActionState = { ok: false, message: "" };

export function AssignToRouteCard({
  orderId,
  state,
}: {
  orderId: string;
  state: OrderRoutingState;
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.assignToRoute;
  const [actionState, action, pending] = useActionState(
    addOrderToRoute,
    initial
  );

  // ─── Already on a route ────────────────────────────────────────────
  if (state.kind === "already_assigned") {
    return (
      <div className="assign-route-card assign-route-card--info">
        <div className="assign-route-card-headline">
          {t.alreadyOnRoute.replace("{name}", state.routeName)}
        </div>
        <div className="assign-route-card-body">{t.alreadyOnRouteBody}</div>
        <div style={{ marginTop: 10 }}>
          <Link
            href={`/dashboard/deliveries/${state.routeId}`}
            className="secondary-btn"
          >
            {t.viewRouteCta}
          </Link>
        </div>
      </div>
    );
  }

  // ─── Blocked: missing a prerequisite ───────────────────────────────
  if (state.kind === "blocked") {
    return (
      <div className="assign-route-card assign-route-card--blocked">
        <div className="assign-route-card-headline">{t.blockedTitle}</div>
        <div className="assign-route-card-body">
          {t.blockerReason[state.reason]}
        </div>
      </div>
    );
  }

  // ─── Eligible — show routes for this date or a create-route CTA ───
  const { eventDateRaw, candidateRoutes } = state;
  const noRoutesYet = candidateRoutes.length === 0;

  return (
    <div className="assign-route-card">
      <div className="assign-route-card-headline">
        {t.eligibleTitle.replace("{date}", eventDateRaw)}
      </div>
      <div className="assign-route-card-body">
        {noRoutesYet ? t.noRoutesBody : t.pickRouteBody}
      </div>

      {!noRoutesYet && (
        <ul className="assign-route-list">
          {candidateRoutes.map((r) => (
            <li key={r.id} className="assign-route-row">
              <div className="assign-route-row-main">
                <div className="assign-route-row-title">{r.name}</div>
                <div className="assign-route-row-meta">
                  {t.stopCount.replace("{n}", String(r.stopCount))}
                  {" · "}
                  {humanRouteStatus(r.routeStatus, t)}
                </div>
              </div>
              <form action={action} style={{ flexShrink: 0 }}>
                <input type="hidden" name="route_id" value={r.id} />
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="route_date" value={eventDateRaw} />
                <input type="hidden" name="stop_type" value="delivery" />
                <button
                  type="submit"
                  className="primary-btn assign-route-row-cta"
                  disabled={pending}
                >
                  {pending ? t.attaching : t.attachCta}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 12 }}>
        <Link
          href={`/dashboard/deliveries?new_route_date=${eventDateRaw}`}
          className={noRoutesYet ? "primary-btn" : "secondary-btn"}
        >
          {t.createRouteCta}
        </Link>
      </div>

      {actionState.message && (
        <div
          role={actionState.ok ? "status" : "alert"}
          aria-live={actionState.ok ? "polite" : "assertive"}
          className={`badge ${actionState.ok ? "success" : "warning"}`}
          style={{ marginTop: 10, padding: "6px 10px", fontSize: 13 }}
        >
          {actionState.message}
        </div>
      )}
    </div>
  );
}

type AssignT = ReturnType<typeof useI18n>["messages"]["forms"]["routing"]["assignToRoute"];

function humanRouteStatus(status: string, t: AssignT): string {
  const map: Record<string, string> = {
    planned: t.routeStatus.planned,
    in_progress: t.routeStatus.inProgress,
    completed: t.routeStatus.completed,
  };
  return map[status] ?? status;
}
