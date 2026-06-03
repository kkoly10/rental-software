"use client";

import { useActionState } from "react";
import {
  updateRoutingMode,
  type SettingsActionState,
} from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: SettingsActionState = { ok: false, message: "" };

/**
 * Sprint 1.5 — Settings → Advanced toggle for Smart Delivery Mode.
 *
 * Auto (default): system auto-creates delivery routes when orders are
 * confirmed and bundles same-day orders together. The operator just
 * presses "Send delivery" on the order page when the crew is ready.
 *
 * Manual: legacy behavior. Operator creates routes by hand from
 * /dashboard/deliveries, adds stops, and starts each route.
 */
export function RoutingModeForm({
  currentMode,
}: {
  currentMode: "auto" | "manual";
}) {
  const [state, formAction, pending] = useActionState(updateRoutingMode, initial);
  const { messages: m } = useI18n();
  const t = m.dashboard.settings.routingMode;
  const target = currentMode === "auto" ? "manual" : "auto";

  return (
    <form action={formAction} className="stack-gap">
      <input type="hidden" name="routing_mode" value={target} />
      <div
        className="order-card"
        style={{ display: "flex", alignItems: "flex-start", gap: 16 }}
      >
        <div style={{ flex: 1 }}>
          <strong>
            {currentMode === "auto" ? t.currentlyAuto : t.currentlyManual}
          </strong>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            {currentMode === "auto" ? t.autoDescription : t.manualDescription}
          </div>
        </div>
        <button
          type="submit"
          className="secondary-btn"
          disabled={pending}
          style={{ fontSize: 13, whiteSpace: "nowrap" }}
        >
          {pending
            ? t.switching
            : currentMode === "auto"
            ? t.switchToManual
            : t.switchToAuto}
        </button>
      </div>
      {state.message && (
        <span
          className={state.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12, alignSelf: "flex-start" }}
          role={state.ok ? undefined : "alert"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
