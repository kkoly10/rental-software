"use client";

import { useState, useMemo } from "react";
import { calculatePrice } from "@/lib/pricing/engine";
import type { PricingRule } from "@/lib/pricing/types";

export function PricingPreview({ rules }: { rules: PricingRule[] }) {
  const today = new Date().toISOString().split("T")[0];
  const [basePrice, setBasePrice] = useState(250);
  const [eventDate, setEventDate] = useState(today);
  const [rentalDays, setRentalDays] = useState(1);

  const calculation = useMemo(
    () =>
      calculatePrice(basePrice, rules, {
        eventDate,
        bookingDate: today,
        rentalDays,
      }),
    [basePrice, rules, eventDate, today, rentalDays]
  );

  return (
    <div className="panel pricing-preview">
      <div className="section-header">
        <div>
          <div className="kicker">Calculator</div>
          <h2 style={{ margin: "6px 0 0" }}>Pricing Preview</h2>
        </div>
      </div>

      <div className="list">
        <label className="order-card">
          <strong>Base price ($)</strong>
          <input
            type="number"
            value={basePrice}
            min={0}
            step={10}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Event date</strong>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Rental days</strong>
          <input
            type="number"
            value={rentalDays}
            min={1}
            onChange={(e) => setRentalDays(Number(e.target.value))}
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>
      </div>

      <div className="pricing-breakdown" style={{ marginTop: 14 }}>
        <div className="order-card">
          <div className="order-row">
            <span>Base price</span>
            <strong>${calculation.basePrice.toFixed(2)}</strong>
          </div>
        </div>

        {calculation.adjustments.length === 0 ? (
          <div className="muted" style={{ padding: "10px 0", textAlign: "center", fontSize: 13 }}>
            No rules apply to this configuration.
          </div>
        ) : (
          calculation.adjustments.map((adj, i) => (
            <div key={i} className="order-card">
              <div className="order-row">
                <span>{adj.ruleName}</span>
                <span
                  className={
                    adj.percentage >= 0
                      ? "pricing-adjustment positive"
                      : "pricing-adjustment negative"
                  }
                >
                  {adj.percentage >= 0 ? "+" : ""}
                  {adj.percentage}% ({adj.amount >= 0 ? "+" : ""}$
                  {adj.amount.toFixed(2)})
                </span>
              </div>
            </div>
          ))
        )}

        <div className="pricing-final">
          <div className="order-row">
            <strong>Final Price</strong>
            <strong>${calculation.finalPrice.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
