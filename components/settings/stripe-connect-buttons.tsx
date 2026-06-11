"use client";

import { useActionState } from "react";
import {
  startStripeConnectOnboarding,
  openStripeExpressDashboard,
  refreshStripeConnectStatus,
  type ConnectActionState,
} from "@/lib/stripe/connect-actions";
import type { ConnectStatus } from "@/lib/stripe/connect";

const IDLE: ConnectActionState = { ok: false, message: "" };

export type ConnectButtonLabels = {
  connect: string;
  resume: string;
  opening: string;
  checkStatus: string;
  checking: string;
  openDashboard: string;
};

/**
 * Action buttons for the Connect card. The onboarding/dashboard
 * actions redirect() on success, so useActionState only ever renders
 * their FAILURE message — success leaves the page. The refresh
 * action stays on-page and reports either way. Labels arrive as
 * props because getMessages() is server-only.
 */
export function StripeConnectButtons({
  status,
  labels,
}: {
  status: ConnectStatus;
  labels: ConnectButtonLabels;
}) {
  const [onboardState, onboardAction, onboardPending] = useActionState(
    () => startStripeConnectOnboarding(),
    IDLE
  );
  const [dashState, dashAction, dashPending] = useActionState(
    () => openStripeExpressDashboard(),
    IDLE
  );
  const [refreshState, refreshAction, refreshPending] = useActionState(
    () => refreshStripeConnectStatus(),
    IDLE
  );

  const failure = [onboardState, dashState, refreshState].find(
    (s) => !s.ok && s.message
  );

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(status === "not_connected" || status === "onboarding_incomplete") && (
          <form action={onboardAction}>
            <button type="submit" className="primary-btn" disabled={onboardPending} style={{ fontSize: 13 }}>
              {onboardPending
                ? labels.opening
                : status === "not_connected"
                  ? labels.connect
                  : labels.resume}
            </button>
          </form>
        )}
        {status !== "not_connected" && (
          <form action={refreshAction}>
            <button type="submit" className="ghost-btn" disabled={refreshPending} style={{ fontSize: 13 }}>
              {refreshPending ? labels.checking : labels.checkStatus}
            </button>
          </form>
        )}
        {status === "ready" && (
          <form action={dashAction}>
            <button type="submit" className="secondary-btn" disabled={dashPending} style={{ fontSize: 13 }}>
              {dashPending ? labels.opening : labels.openDashboard}
            </button>
          </form>
        )}
      </div>
      {refreshState.ok && refreshState.message && (
        <span className="badge success" style={{ fontSize: 12, marginTop: 8, display: "inline-block" }}>
          {refreshState.message}
        </span>
      )}
      {failure && (
        <span className="badge warning" style={{ fontSize: 12, marginTop: 8, display: "inline-block" }} role="alert">
          {failure.message}
        </span>
      )}
    </div>
  );
}
