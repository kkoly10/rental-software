"use client";

import { useActionState } from "react";
import { logMaintenance, type MaintenanceActionState } from "@/lib/maintenance/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: MaintenanceActionState = { ok: false, message: "" };

type Product = { id: string; name: string };

const MAINTENANCE_TYPE_VALUES = [
  "cleaning",
  "inspection",
  "repair",
  "seam_repair",
  "blower_service",
  "oil_change",
  "replacement",
  "service",
] as const;

type MaintenanceTypeValue = typeof MAINTENANCE_TYPE_VALUES[number];

export function LogMaintenanceForm({ products }: { products: Product[] }) {
  const [state, action, pending] = useActionState(logMaintenance, initial);
  const { messages } = useI18n();
  const m = messages.forms.maintenance;

  const typeLabels: Record<MaintenanceTypeValue, string> = {
    cleaning: m.types.cleaning,
    inspection: m.types.inspection,
    repair: m.types.repair,
    seam_repair: m.types.seamRepair,
    blower_service: m.types.blowerService,
    oil_change: m.types.oilChange,
    replacement: m.types.replacement,
    service: m.types.service,
  };

  if (state.ok) {
    return (
      <div className="order-card" style={{ padding: 16 }}>
        <span className="badge success">{m.logged}</span>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={action} className="order-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {m.productLabel}
          </label>
          <select
            name="product_id"
            required
            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            <option value="">{m.selectProduct}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {m.typeLabel}
          </label>
          <select
            name="maintenance_type"
            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            {MAINTENANCE_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>{typeLabels[value]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
          {m.notesLabel}
        </label>
        <textarea
          name="notes"
          placeholder={m.notesPlaceholder}
          rows={2}
          style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {m.costLabel}
          </label>
          <input
            name="cost_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          />
        </div>
        <div style={{ paddingTop: 20 }}>
          <button type="submit" className="primary-btn" disabled={pending} style={{ whiteSpace: "nowrap" }}>
            {pending ? m.submitting : m.submit}
          </button>
        </div>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ fontSize: 12 }}>{state.message}</div>
      )}
    </form>
  );
}
