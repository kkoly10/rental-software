"use client";

import { useActionState } from "react";
import {
  optimizeRoute,
  type OptimizeRouteState,
} from "@/lib/logistics/optimize-route-action";

const initial: OptimizeRouteState = { ok: false, message: "" };

/**
 * Sprint 5 — "Optimize route" button on the route detail page.
 *
 * Owner/admin/dispatcher; hidden when the route is already
 * in-progress or completed. After a successful optimize, the button
 * shows the distance/time summary so the operator sees the result
 * without scrolling to find a separate panel.
 */
export function OptimizeRouteButton({
  routeId,
  routeStatus,
}: {
  routeId: string;
  routeStatus: string;
}) {
  const [state, formAction, pending] = useActionState(optimizeRoute, initial);

  if (routeStatus !== "planned") return null;

  return (
    <form
      action={formAction}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <input type="hidden" name="route_id" value={routeId} />
      <button
        type="submit"
        className="secondary-btn"
        style={{ fontSize: 13 }}
        disabled={pending}
      >
        {pending ? "Optimizing…" : "Optimize route"}
      </button>
      {state.message && (
        <span
          className={state.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12 }}
          role={state.ok ? undefined : "alert"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
