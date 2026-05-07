"use client";

import { useActionState } from "react";
import { logMaintenance, type MaintenanceActionState } from "@/lib/maintenance/actions";

const initial: MaintenanceActionState = { ok: false, message: "" };

type Product = { id: string; name: string };

const MAINTENANCE_TYPES = [
  { value: "cleaning", label: "Cleaning" },
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "seam_repair", label: "Seam Repair" },
  { value: "blower_service", label: "Blower Service" },
  { value: "oil_change", label: "Oil Change" },
  { value: "replacement", label: "Part Replacement" },
  { value: "service", label: "General Service" },
];

export function LogMaintenanceForm({ products }: { products: Product[] }) {
  const [state, action, pending] = useActionState(logMaintenance, initial);

  if (state.ok) {
    return (
      <div className="order-card" style={{ padding: 16 }}>
        <span className="badge success">Logged</span>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={action} className="order-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Log maintenance</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Product / equipment
          </label>
          <select
            name="product_id"
            required
            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Type
          </label>
          <select
            name="maintenance_type"
            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            {MAINTENANCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
          Notes
        </label>
        <textarea
          name="notes"
          placeholder="Describe the issue or work performed…"
          rows={2}
          style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            Cost ($)
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
            {pending ? "Saving…" : "Log maintenance"}
          </button>
        </div>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ fontSize: 12 }}>{state.message}</div>
      )}
    </form>
  );
}
