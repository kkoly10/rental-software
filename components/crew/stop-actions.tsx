"use client";

import { useState } from "react";
import { updateStopStatus } from "@/lib/crew/actions";

const STATUS_FLOW: Record<string, { next: string; label: string }[]> = {
  assigned: [{ next: "en_route", label: "En Route" }],
  en_route: [{ next: "completed", label: "Mark Complete" }],
  in_progress: [{ next: "completed", label: "Mark Complete" }],
  completed: [],
};

export function StopActionButtons({ stopId, currentStatus }: { stopId: string; currentStatus: string }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const actions = STATUS_FLOW[status] ?? [{ next: "completed", label: "Mark Complete" }];

  if (actions.length === 0) {
    return <span className="badge success" style={{ fontSize: 11 }}>Done</span>;
  }

  async function handleAction(nextStatus: string) {
    setPending(true);
    const result = await updateStopStatus(stopId, nextStatus);
    if (result.ok) {
      setStatus(nextStatus);
    }
    setPending(false);
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {actions.map((action) => (
        <button
          key={action.next}
          className="primary-btn"
          style={{ fontSize: 12, padding: "6px 12px" }}
          onClick={() => handleAction(action.next)}
          disabled={pending}
        >
          {pending ? "Updating..." : action.label}
        </button>
      ))}
    </div>
  );
}
