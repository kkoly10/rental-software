"use client";

import { useActionState, useState } from "react";
import { createSeriesFromOrder } from "@/lib/orders/series";
import type { SeriesActionState } from "@/lib/orders/series";

const initial: SeriesActionState = { ok: false, message: "" };

/**
 * Sprint 3 — inline "Make recurring" form on the order detail page.
 *
 * The form is collapsed behind a button by default — most orders are
 * one-offs and the visible form would clutter the page. Clicking
 * "Make recurring" expands the cadence chooser.
 *
 * Hidden when:
 *   - The order is already part of a series (parent surface a
 *     different card)
 *   - The order is cancelled / refunded (recurring makes no sense)
 */
export function MakeRecurringForm({
  orderId,
  orderStatus,
  alreadyInSeries,
}: {
  orderId: string;
  orderStatus: string;
  alreadyInSeries: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createSeriesFromOrder,
    initial,
  );
  const [expanded, setExpanded] = useState(false);

  if (alreadyInSeries || ["cancelled", "refunded"].includes(orderStatus.toLowerCase())) {
    return null;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="ghost-btn"
        style={{ fontSize: 13 }}
        onClick={() => setExpanded(true)}
      >
        Make recurring
      </button>
    );
  }

  if (state.ok) {
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {state.message}
      </span>
    );
  }

  return (
    <form
      action={formAction}
      className="order-card"
      style={{ maxWidth: 520 }}
    >
      <input type="hidden" name="template_order_id" value={orderId} />
      <strong>Make this a recurring booking</strong>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Korent will auto-generate future bookings on this cadence using
        the same items, customer, and address. You can cancel or pause
        the series at any time.
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <label>
          <span style={{ fontSize: 12, color: "var(--muted-color)" }}>
            Cadence
          </span>
          <select name="frequency" required defaultValue="weekly">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </label>
        <label>
          <span style={{ fontSize: 12, color: "var(--muted-color)" }}>
            Every (multiplier)
          </span>
          <input
            type="number"
            name="interval_count"
            min={1}
            max={52}
            defaultValue={1}
            required
          />
        </label>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <label>
          <span style={{ fontSize: 12, color: "var(--muted-color)" }}>
            End date (optional)
          </span>
          <input type="date" name="end_date" />
        </label>
        <label>
          <span style={{ fontSize: 12, color: "var(--muted-color)" }}>
            Or max occurrences
          </span>
          <input
            type="number"
            name="max_occurrences"
            min={2}
            max={1000}
            placeholder="e.g. 12"
          />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Generating bookings…" : "Create series"}
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setExpanded(false)}
        >
          Cancel
        </button>
      </div>

      {state.message && !state.ok && (
        <div
          className="badge warning"
          style={{ fontSize: 12, marginTop: 8 }}
          role="alert"
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
