"use client";

import { useState } from "react";
import { updateStopStatus } from "@/lib/crew/actions";
import { useI18n } from "@/lib/i18n/provider";

export function StopActionButtons({ stopId, currentStatus }: { stopId: string; currentStatus: string }) {
  const { messages } = useI18n();
  const t = messages.forms.crew.stopActions;

  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  // `pendingConfirm` holds the action awaiting confirmation. Null means no
  // prompt is open. A two-step click prevents mis-taps on a phone in a moving
  // truck from silently firing customer-facing SMS/email side effects.
  const [pendingConfirm, setPendingConfirm] = useState<{ next: string; label: string } | null>(null);

  const STATUS_FLOW: Record<string, { next: string; label: string }[]> = {
    assigned: [{ next: "en_route", label: t.markEnRoute }],
    en_route: [{ next: "completed", label: t.markCompleted }],
    in_progress: [{ next: "completed", label: t.markCompleted }],
    completed: [],
  };

  const actions = STATUS_FLOW[status] ?? [{ next: "completed", label: t.markCompleted }];

  if (actions.length === 0) {
    return <span className="badge success" style={{ fontSize: 11 }}>{t.done}</span>;
  }

  function confirmCopyFor(next: string): string {
    if (next === "en_route") return t.confirmEnRoute;
    if (next === "completed") return t.confirmCompleted;
    return t.confirmGeneric;
  }

  async function handleAction(nextStatus: string) {
    setPending(true);
    setError(null);
    const result = await updateStopStatus(stopId, nextStatus);
    if (result.ok) {
      setStatus(nextStatus);
      setPendingConfirm(null);
    } else {
      setError(result.message ?? t.updateFailed);
    }
    setPending(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {actions.map((action) => (
          <button
            key={action.next}
            className="primary-btn"
            style={{ fontSize: 12, padding: "6px 12px" }}
            onClick={() => setPendingConfirm(action)}
            disabled={pending || pendingConfirm !== null}
          >
            {action.label}
          </button>
        ))}
      </div>
      {pendingConfirm && (
        <div
          role="alertdialog"
          aria-label={pendingConfirm.label}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 10,
            background: "var(--surface-muted)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12,
          }}
        >
          <span>{confirmCopyFor(pendingConfirm.next)}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="primary-btn"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => handleAction(pendingConfirm.next)}
              disabled={pending}
            >
              {pending ? t.updating : t.confirm}
            </button>
            <button
              type="button"
              className="secondary-btn"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setPendingConfirm(null)}
              disabled={pending}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {error && (
        <span style={{ fontSize: 12, color: "var(--danger, #e53e3e)" }}>{error}</span>
      )}
    </div>
  );
}
