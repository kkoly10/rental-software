"use client";

import { useActionState } from "react";
import { blockProductDates } from "@/lib/availability/actions";

export function BlockDatesForm() {
  const [state, formAction, pending] = useActionState(blockProductDates, {
    ok: true,
    message: "",
  });

  return (
    <form action={formAction}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Product ID</span>
          <input name="product_id" type="text" placeholder="Product UUID" required />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Start date</span>
            <input name="start_date" type="date" required />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>End date</span>
            <input name="end_date" type="date" />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Reason</span>
          <select name="block_type" defaultValue="manual_hold">
            <option value="manual_hold">Manual hold</option>
            <option value="maintenance">Maintenance</option>
            <option value="private_event">Private event</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Notes (optional)</span>
          <input name="reason" type="text" placeholder="Reason for blocking" />
        </label>

        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Blocking..." : "Block Dates"}
        </button>
      </div>

      {state.message && (
        <div className={`badge ${state.ok ? "success" : "warning"}`} style={{ marginTop: 10 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
