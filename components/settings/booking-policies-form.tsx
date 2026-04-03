"use client";

import { useActionState } from "react";
import { updateBookingPolicies } from "@/lib/settings/actions";
import type { BookingPolicies } from "@/lib/data/booking-policies";

const initialState = { ok: false, message: "" };

export function BookingPoliciesForm({ defaults }: { defaults: BookingPolicies }) {
  const [state, formAction, pending] = useActionState(updateBookingPolicies, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <div className="grid grid-2">
        <label className="order-card">
          <strong>Deposit percentage (%)</strong>
          <input
            name="deposit_percentage"
            type="number"
            min="0"
            max="100"
            step="1"
            defaultValue={defaults.depositPercentage}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Percentage of the order total required as deposit. Set to 0 for no deposit.
          </div>
        </label>

        <label className="order-card">
          <strong>Minimum deposit ($)</strong>
          <input
            name="deposit_minimum"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaults.depositMinimum ?? ""}
            placeholder="No minimum"
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Minimum deposit regardless of percentage. Leave blank for no minimum.
          </div>
        </label>
      </div>

      <label className="order-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          name="require_deposit_to_confirm"
          type="checkbox"
          defaultChecked={defaults.requireDepositToConfirm}
        />
        <div>
          <strong>Require deposit to confirm booking</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            When enabled, orders stay in &ldquo;Awaiting Deposit&rdquo; until deposit is received. When disabled, orders are confirmed immediately.
          </div>
        </div>
      </label>

      <div className="grid grid-2">
        <label className="order-card">
          <strong>Booking lead time (hours)</strong>
          <input
            name="booking_lead_time_hours"
            type="number"
            min="0"
            step="1"
            defaultValue={defaults.bookingLeadTimeHours}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Minimum hours before an event that a customer can book. Prevents last-minute bookings.
          </div>
        </label>

        <label className="order-card">
          <strong>Max advance booking (days)</strong>
          <input
            name="max_advance_booking_days"
            type="number"
            min="1"
            step="1"
            defaultValue={defaults.maxAdvanceBookingDays}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            How far in advance customers can book.
          </div>
        </label>
      </div>

      <label className="order-card">
        <strong>Cancellation policy</strong>
        <textarea
          name="cancellation_policy_text"
          placeholder="e.g., Full refund if cancelled 48+ hours before event. 50% refund within 48 hours."
          rows={3}
          maxLength={2000}
          defaultValue={defaults.cancellationPolicyText ?? ""}
          style={{
            marginTop: 10,
            width: "100%",
            fontFamily: "inherit",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        />
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          Shown to customers at checkout. Leave blank to hide.
        </div>
      </label>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <button className="primary-btn" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Booking Policies"}
      </button>
    </form>
  );
}
