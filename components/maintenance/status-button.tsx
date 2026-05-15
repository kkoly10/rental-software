"use client";

import { useActionState } from "react";
import { updateMaintenanceStatus, type MaintenanceActionState } from "@/lib/maintenance/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: MaintenanceActionState = { ok: false, message: "" };

const NEXT_STATUS_CONFIG: Record<string, { value: string; labelKey: "startWork" | "markResolved" | "logRepair" | "flagIssue"; className: string }> = {
  open: { value: "in_progress", labelKey: "startWork", className: "primary-btn" },
  in_progress: { value: "resolved", labelKey: "markResolved", className: "primary-btn" },
  service_due: { value: "open", labelKey: "logRepair", className: "ghost-btn" },
  ready: { value: "open", labelKey: "flagIssue", className: "ghost-btn" },
};

export function MaintenanceStatusButton({ recordId, currentStatus }: { recordId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(updateMaintenanceStatus, initial);
  const { messages: m } = useI18n();

  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  const next = NEXT_STATUS_CONFIG[normalized];
  if (!next) return null;
  const label = m.forms.maintenanceStatus[next.labelKey];

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="status" value={next.value} />
      <button type="submit" className={next.className} disabled={pending} style={{ fontSize: 12, padding: "4px 10px" }}>
        {pending ? "…" : label}
      </button>
      {state.message && !state.ok && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--danger, #e53e3e)" }}>
          {state.message}
        </span>
      )}
    </form>
  );
}
