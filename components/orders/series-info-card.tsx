"use client";

import { useActionState } from "react";
import { cancelSeries, setSeriesStatus } from "@/lib/orders/series";
import type { SeriesActionState } from "@/lib/orders/series";

const initial: SeriesActionState = { ok: false, message: "" };

/**
 * Sprint 3 — shown on a child order's detail page when the order
 * belongs to a recurring series. Surfaces the cadence summary and the
 * pause / cancel controls.
 *
 * The cancel form has a confirm checkbox for "also cancel future
 * bookings" because that's the destructive choice — series-only cancel
 * leaves the existing children alone, which is usually what the
 * operator wants when they just don't want NEW occurrences.
 */
export function SeriesInfoCard({
  seriesId,
  occurrenceNumber,
  frequency,
  intervalCount,
  status,
  startDate,
  endDate,
  maxOccurrences,
}: {
  seriesId: string;
  occurrenceNumber: number | null;
  frequency: string;
  intervalCount: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  maxOccurrences: number | null;
}) {
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSeries, initial);
  const [statusState, statusAction, statusPending] = useActionState(setSeriesStatus, initial);

  const cadenceLabel = describeCadence(frequency, intervalCount);
  const terminusLabel = endDate
    ? `until ${endDate}`
    : maxOccurrences
    ? `for ${maxOccurrences} occurrences`
    : "indefinitely";

  return (
    <article className="order-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <strong>Part of a recurring series</strong>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {cadenceLabel} starting {startDate ?? "—"} {terminusLabel}.
          </div>
          {occurrenceNumber && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              This is occurrence #{occurrenceNumber}.
            </div>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Series status: <strong>{status}</strong>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {status === "active" && (
          <form action={statusAction} style={{ display: "inline" }}>
            <input type="hidden" name="series_id" value={seriesId} />
            <input type="hidden" name="status" value="paused" />
            <button
              type="submit"
              className="ghost-btn"
              style={{ fontSize: 13 }}
              disabled={statusPending}
            >
              {statusPending ? "Saving…" : "Pause series"}
            </button>
          </form>
        )}
        {status === "paused" && (
          <form action={statusAction} style={{ display: "inline" }}>
            <input type="hidden" name="series_id" value={seriesId} />
            <input type="hidden" name="status" value="active" />
            <button
              type="submit"
              className="ghost-btn"
              style={{ fontSize: 13 }}
              disabled={statusPending}
            >
              {statusPending ? "Saving…" : "Resume series"}
            </button>
          </form>
        )}
        {status !== "cancelled" && status !== "completed" && (
          <form action={cancelAction} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="hidden" name="series_id" value={seriesId} />
            <label style={{ fontSize: 12, color: "var(--muted-color)" }}>
              <input
                type="checkbox"
                name="cancel_future"
                value="true"
                style={{ marginRight: 4 }}
              />
              Also cancel future bookings
            </label>
            <button
              type="submit"
              className="ghost-btn"
              style={{ fontSize: 13 }}
              disabled={cancelPending}
            >
              {cancelPending ? "Cancelling…" : "Cancel series"}
            </button>
          </form>
        )}
      </div>

      {statusState.message && (
        <div
          className={statusState.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12, marginTop: 8, display: "inline-block" }}
          role={statusState.ok ? undefined : "alert"}
        >
          {statusState.message}
        </div>
      )}
      {cancelState.message && (
        <div
          className={cancelState.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12, marginTop: 8, display: "inline-block" }}
          role={cancelState.ok ? undefined : "alert"}
        >
          {cancelState.message}
        </div>
      )}
    </article>
  );
}

function describeCadence(frequency: string, intervalCount: number): string {
  const noun: Record<string, string> = {
    daily: "day",
    weekly: "week",
    biweekly: "2 weeks",
    monthly: "month",
    quarterly: "quarter",
  };
  const unit = noun[frequency] ?? frequency;
  if (intervalCount === 1) return `Every ${unit}`;
  return `Every ${intervalCount} ${unit}${unit.endsWith("s") ? "" : "s"}`;
}
