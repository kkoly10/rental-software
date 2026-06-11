"use client";

import { useActionState, useMemo, useState } from "react";
import { requestExtension, type ExtensionState } from "@/lib/market/extension-actions";

const initial: ExtensionState = { ok: false, message: "" };

/**
 * "Keep it longer" (roadmap item 4): renter picks a new return date,
 * sees the price estimate before submitting (final incl. tax confirmed
 * in the request result), and is charged only at approval.
 */
export function ExtensionForm({
  bookingId,
  endsAt,
  dailyPriceCents,
  quantity,
  instantBook,
}: {
  bookingId: string;
  endsAt: string;
  dailyPriceCents: number;
  quantity: number;
  instantBook: boolean;
}) {
  const [state, action, pending] = useActionState(requestExtension, initial);
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState("");

  const currentEnd = new Date(endsAt);
  const minDate = new Date(currentEnd.getTime() + 86_400_000).toISOString().slice(0, 10);
  const maxDate = new Date(currentEnd.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const estimate = useMemo(() => {
    if (!newDate) return null;
    const target = new Date(`${newDate}T00:00:00Z`);
    const endYmd = new Date(Date.UTC(currentEnd.getUTCFullYear(), currentEnd.getUTCMonth(), currentEnd.getUTCDate()));
    const days = Math.round((target.getTime() - endYmd.getTime()) / 86_400_000);
    if (!Number.isFinite(days) || days < 1) return null;
    return { days, cents: days * dailyPriceCents * quantity };
  }, [newDate, currentEnd, dailyPriceCents, quantity]);

  if (state.ok) {
    return <p className="mk-msg ok">{state.message}</p>;
  }

  if (!open) {
    return (
      <button type="button" className="mk-btn ghost" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>
        Keep it longer
      </button>
    );
  }

  return (
    <form action={action} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 4 }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--mk-ink-soft)", marginBottom: 4 }}>
          New return date
        </label>
        <input
          type="date"
          name="new_end_date"
          required
          min={minDate}
          max={maxDate}
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          style={{ font: "inherit", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--mk-line)" }}
        />
      </div>
      <button type="submit" className="mk-btn" style={{ fontSize: 13 }} disabled={pending || !estimate}>
        {pending
          ? "Sending…"
          : estimate
            ? `Request +${estimate.days} day${estimate.days === 1 ? "" : "s"} (≈$${(estimate.cents / 100).toFixed(0)} + tax)`
            : "Request extension"}
      </button>
      <span className="mk-card-m" style={{ flexBasis: "100%" }}>
        {instantBook
          ? "⚡ Instant-book item: if the dates are free, you're confirmed and charged immediately."
          : "You're charged only if the seller approves (they have 12 hours). No late fees accrue while a request is pending."}
      </span>
      {state.message ? <span className="mk-msg err">{state.message}</span> : null}
    </form>
  );
}
