"use client";

import { useActionState } from "react";
import { updateMaintenanceStatus, type MaintenanceActionState } from "@/lib/maintenance/actions";

const initial: MaintenanceActionState = { ok: false, message: "" };

const NEXT_STATUS: Record<string, { value: string; label: string; className: string }> = {
  open: { value: "in_progress", label: "Start work", className: "primary-btn" },
  in_progress: { value: "resolved", label: "Mark resolved", className: "primary-btn" },
  service_due: { value: "open", label: "Log repair", className: "ghost-btn" },
  ready: { value: "open", label: "Flag issue", className: "ghost-btn" },
};

export function MaintenanceStatusButton({ recordId, currentStatus }: { recordId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(updateMaintenanceStatus, initial);

  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  const next = NEXT_STATUS[normalized];
  if (!next) return null;

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="status" value={next.value} />
      <button type="submit" className={next.className} disabled={pending} style={{ fontSize: 12, padding: "4px 10px" }}>
        {pending ? "…" : next.label}
      </button>
      {state.message && !state.ok && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--danger, #e53e3e)" }}>
          {state.message}
        </span>
      )}
    </form>
  );
}
