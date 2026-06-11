"use client";

import { useActionState, useState } from "react";
import {
  requestBooking,
  type BookingActionState,
} from "@/lib/market/booking-actions";

const initial: BookingActionState = { ok: false, message: "" };

export type SellerExtraOption = {
  id: string;
  title: string;
  dailyPriceCents: number;
  maxQuantity: number;
};

export function BookingRequestForm({
  listingId,
  maxQuantity,
  instant = false,
  sellerExtras = [],
}: {
  listingId: string;
  maxQuantity: number;
  instant?: boolean;
  /** Other published listings from the same seller (roadmap item 5):
   *  one booking, line items, one deposit, one payment. */
  sellerExtras?: SellerExtraOption[];
}) {
  const [state, action, pending] = useActionState(requestBooking, initial);
  // listingId → quantity for added extras (max 4).
  const [extras, setExtras] = useState<Record<string, number>>({});
  const extraItemsJson = JSON.stringify(
    Object.entries(extras).map(([id, quantity]) => ({ listingId: id, quantity })),
  );

  function toggleExtra(id: string) {
    setExtras((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else if (Object.keys(next).length < 4) next[id] = 1;
      return next;
    });
  }

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
      {sellerExtras.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Add more from this seller (one booking, one deposit)
          </div>
          <input type="hidden" name="extra_items" value={extraItemsJson} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sellerExtras.map((x) => (
              <label
                key={x.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  background: extras[x.id] ? "#fdf6ec" : "transparent",
                  borderRadius: 10,
                  padding: "6px 8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(extras[x.id])}
                  onChange={() => toggleExtra(x.id)}
                />
                <span style={{ flex: 1 }}>
                  {x.title}{" "}
                  <span style={{ color: "var(--mk-ink-soft)" }}>
                    ${(x.dailyPriceCents / 100).toFixed(0)}/day
                  </span>
                </span>
                {extras[x.id] && x.maxQuantity > 1 ? (
                  <input
                    type="number"
                    min={1}
                    max={x.maxQuantity}
                    value={extras[x.id]}
                    onChange={(e) =>
                      setExtras((prev) => ({
                        ...prev,
                        [x.id]: Math.max(1, Math.min(x.maxQuantity, Number(e.target.value) || 1)),
                      }))
                    }
                    style={{ width: 58, padding: 4, border: "1px solid var(--mk-line)", borderRadius: 8, font: "inherit" }}
                  />
                ) : null}
              </label>
            ))}
          </div>
        </div>
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
        {pending ? (instant ? "Reserving…" : "Sending…") : instant ? "⚡ Book now" : "Request to book"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}
