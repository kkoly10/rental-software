"use client";

import { useActionState } from "react";
import { blockProductDates } from "@/lib/availability/actions";
import { useI18n } from "@/lib/i18n/provider";

export function BlockDatesForm({
  products,
}: {
  products?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(blockProductDates, {
    ok: true,
    message: "",
  });
  const { messages } = useI18n();
  const m = messages.forms.blockDates;
  const productOptions = products ?? [];

  return (
    <form action={formAction}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.productIdLabel}</span>
          {productOptions.length > 0 ? (
            <select name="product_id" required defaultValue="">
              <option value="" disabled>
                {m.productIdPlaceholder}
              </option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            // Fallback for callers that don't pass products (and for safety
            // if no products exist yet) — keep the original raw input rather
            // than rendering an empty select.
            <input name="product_id" type="text" placeholder={m.productIdPlaceholder} required />
          )}
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.startDateLabel}</span>
            <input name="start_date" type="date" required />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.endDateLabel}</span>
            <input name="end_date" type="date" />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.reasonLabel}</span>
          <select name="block_type" defaultValue="manual_hold">
            <option value="manual_hold">{m.blockTypes.manualHold}</option>
            <option value="maintenance">{m.blockTypes.maintenance}</option>
            <option value="private_event">{m.blockTypes.privateEvent}</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.notesLabel}</span>
          <input name="reason" type="text" placeholder={m.notesPlaceholder} />
        </label>

        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? m.submitting : m.submit}
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
