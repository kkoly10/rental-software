"use client";

import { useActionState } from "react";
import {
  requestBooking,
  type BookingActionState,
} from "@/lib/market/booking-actions";

const initial: BookingActionState = { ok: false, message: "" };

export function BookingRequestForm({
  listingId,
  maxQuantity,
}: {
  listingId: string;
  maxQuantity: number;
}) {
  const [state, action, pending] = useActionState(requestBooking, initial);

  if (state.ok) {
    return <p className="mk-msg ok">✓ {state.message}</p>;
  }

  const today = new Date();
  const minDate = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

  return (
    <form action={action} style={{ marginTop: 14 }}>
      <input type="hidden" name="listing_id" value={listingId} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          Start
          <input
            type="date"
            name="start_date"
            required
            min={minDate}
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--mk-line)", borderRadius: 10, font: "inherit" }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          End
          <input
            type="date"
            name="end_date"
            required
            min={minDate}
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--mk-line)", borderRadius: 10, font: "inherit" }}
          />
        </label>
      </div>
      {maxQuantity > 1 ? (
        <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginTop: 10 }}>
          Quantity (up to {maxQuantity})
          <input
            type="number"
            name="quantity"
            min={1}
            max={maxQuantity}
            defaultValue={1}
            style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--mk-line)", borderRadius: 10, font: "inherit" }}
          />
        </label>
      ) : null}
      <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginTop: 10 }}>
        Message to the seller (optional)
        <textarea
          name="message"
          maxLength={1000}
          rows={2}
          style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--mk-line)", borderRadius: 10, font: "inherit" }}
        />
      </label>
      <button type="submit" className="mk-btn" style={{ width: "100%", marginTop: 12 }} disabled={pending}>
        {pending ? "Sending…" : "Request to book"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}
