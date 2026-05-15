"use client";

import { useActionState } from "react";
import { updateBookingPolicies } from "@/lib/settings/actions";
import type { BookingPolicies } from "@/lib/data/booking-policies";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function BookingPoliciesForm({ defaults }: { defaults: BookingPolicies }) {
  const [state, formAction, pending] = useActionState(updateBookingPolicies, initialState);
  const { messages } = useI18n();
  const m = messages.forms.bookingPolicies;

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <div className="grid grid-2">
        <label className="order-card">
          <strong>{m.depositPercentageLabel}</strong>
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
            {m.depositPercentageHelp}
          </div>
        </label>

        <label className="order-card">
          <strong>{m.depositMinimumLabel}</strong>
          <input
            name="deposit_minimum"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaults.depositMinimum ?? ""}
            placeholder={m.depositMinimumPlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            {m.depositMinimumHelp}
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
          <strong>{m.requireDepositToConfirmTitle}</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            {m.requireDepositToConfirmHelp}
          </div>
        </div>
      </label>

      <div className="grid grid-2">
        <label className="order-card">
          <strong>{m.bookingLeadTimeHoursLabel}</strong>
          <input
            name="booking_lead_time_hours"
            type="number"
            min="0"
            step="1"
            defaultValue={defaults.bookingLeadTimeHours}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            {m.bookingLeadTimeHoursHelp}
          </div>
        </label>

        <label className="order-card">
          <strong>{m.maxAdvanceBookingDaysLabel}</strong>
          <input
            name="max_advance_booking_days"
            type="number"
            min="1"
            step="1"
            defaultValue={defaults.maxAdvanceBookingDays}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            {m.maxAdvanceBookingDaysHelp}
          </div>
        </label>
      </div>

      <label className="order-card">
        <strong>{m.cancellationPolicyLabel}</strong>
        <textarea
          name="cancellation_policy_text"
          placeholder={m.cancellationPolicyPlaceholder}
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
          {m.cancellationPolicyHelp}
        </div>
      </label>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <button className="primary-btn" type="submit" disabled={pending}>
        {pending ? m.submitting : m.submit}
      </button>
    </form>
  );
}
