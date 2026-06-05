"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  // ─── Already on a route ────────────────────────────────────────────
  if (state.kind === "already_assigned") {
    return (
      <div className="assign-route-card assign-route-card--info">
        <div className="assign-route-card-headline">
          {t.alreadyOnRoute.replace("{name}", state.routeName || messages.common.routeFallback)}
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
  const { eventDateRaw, candidateRoutes, hasNonPlannedRoutes } = state;
  const noRoutesYet = candidateRoutes.length === 0;

  return (
    <div className="assign-route-card">
      <div className="assign-route-card-headline">
        {t.eligibleTitle.replace("{date}", eventDateRaw)}
      </div>
      <div className="assign-route-card-body">
        {noRoutesYet ? t.noRoutesBody : t.pickRouteBody}
      </div>
      {hasNonPlannedRoutes && (
        <div
          className="assign-route-card-body"
          style={{ fontStyle: "italic", opacity: 0.85, marginTop: 4 }}
        >
          {t.inProgressRoutesHint}
        </div>
      )}

      {!noRoutesYet && (
        <ul className="assign-route-list">
          {candidateRoutes.map((r) => (
            <AttachToRouteRow
              key={r.id}
              orderId={orderId}
              routeId={r.id}
              routeName={r.name}
              routeStatus={r.routeStatus}
              stopCount={r.stopCount}
              eventDateRaw={eventDateRaw}
              t={t}
              fallbackName={messages.common.routeFallback}
            />
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
    </div>
  );
}

// One-row form so each row has its own action state — clicking row B
// while row A is pending no longer overwrites A's result, and the
// success badge appears beside the row it relates to.  router.refresh()
// after success re-renders the page so the card flips to its
// `already_assigned` state instead of staying on `eligible`.
function AttachToRouteRow({
  orderId,
  routeId,
  routeName,
  routeStatus,
  stopCount,
  eventDateRaw,
  t,
  fallbackName,
}: {
  orderId: string;
  routeId: string;
  routeName: string;
  routeStatus: string;
  stopCount: number;
  eventDateRaw: string;
  t: AssignT;
  fallbackName: string;
}) {
  const router = useRouter();
  const [actionState, action, pending] = useActionState(addOrderToRoute, initial);

  // On success: re-fetch server props so the parent card recomputes its
  // OrderRoutingState ('eligible' → 'already_assigned').  Keep the
  // success badge visible briefly via the rendered actionState.message.
  useEffect(() => {
    if (actionState.ok) router.refresh();
  }, [actionState.ok, router]);

  return (
    <li className="assign-route-row">
      <div className="assign-route-row-main">
        <div className="assign-route-row-title">{routeName || fallbackName}</div>
        <div className="assign-route-row-meta">
          {t.stopCount.replace("{n}", String(stopCount))}
          {" · "}
          {humanRouteStatus(routeStatus, t)}
        </div>
        {actionState.message && (
          <div
            role={actionState.ok ? "status" : "alert"}
            aria-live={actionState.ok ? "polite" : "assertive"}
            className={`badge ${actionState.ok ? "success" : "warning"}`}
            style={{ marginTop: 6, padding: "4px 8px", fontSize: 12, display: "inline-block" }}
          >
            {actionState.message}
          </div>
        )}
      </div>
      <form action={action} style={{ flexShrink: 0 }}>
        <input type="hidden" name="route_id" value={routeId} />
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
