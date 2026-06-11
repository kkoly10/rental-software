"use client";

import { useActionState, useState } from "react";
import { openDispute, type DisputeActionState } from "@/lib/market/dispute-actions";

const initial: DisputeActionState = { ok: false, message: "" };

const TYPES: Array<{ value: string; label: string }> = [
  { value: "item_not_working", label: "Item not working" },
  { value: "damage", label: "Damage" },
  { value: "missing_accessories", label: "Missing accessories" },
  { value: "late_return", label: "Late return" },
  { value: "non_return", label: "Not returned" },
  { value: "condition_mismatch", label: "Condition mismatch" },
  { value: "seller_no_show", label: "Seller no-show" },
  { value: "renter_no_show", label: "Renter no-show" },
  { value: "billing_issue", label: "Billing issue" },
];

export function DisputeForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(openDispute, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", marginTop: 6 }}>✓ {state.message}</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid #b91c1c", color: "#b91c1c", background: "transparent", cursor: "pointer", marginTop: 8 }}
      >
        ⚠️ Report an issue
      </button>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "100%" }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <select name="dispute_type" required style={{ fontSize: 12, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8", maxWidth: 260 }}>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        placeholder="What happened? Evidence photos on the booking will be reviewed alongside this."
        style={{ fontSize: 12, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid #b91c1c", color: "#fff", background: "#b91c1c", cursor: "pointer" }}>
          {pending ? "Opening…" : "Open dispute"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 999, border: "1px solid #e5e0d8", background: "transparent", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      {state.message ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{state.message}</span> : null}
    </form>
  );
}
