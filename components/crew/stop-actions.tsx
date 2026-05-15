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

  async function handleAction(nextStatus: string) {
    setPending(true);
    setError(null);
    const result = await updateStopStatus(stopId, nextStatus);
    if (result.ok) {
      setStatus(nextStatus);
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
            onClick={() => handleAction(action.next)}
            disabled={pending}
          >
            {pending ? t.updating : action.label}
          </button>
        ))}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: "var(--danger, #e53e3e)" }}>{error}</span>
      )}
    </div>
  );
}
