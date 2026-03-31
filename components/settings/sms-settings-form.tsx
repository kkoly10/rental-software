"use client";

import { useActionState } from "react";
import { updateSmsSettings } from "@/lib/sms/actions";
import type { SmsSettings } from "@/lib/data/sms-settings";

const initialState = { ok: false, message: "" };

export function SmsSettingsForm({ defaults }: { defaults: SmsSettings }) {
  const [state, formAction, pending] = useActionState(
    updateSmsSettings,
    initialState
  );

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <div className="sms-toggle-row order-card">
        <div>
          <strong>Enable SMS notifications</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Send text messages to customers for order updates
          </div>
        </div>
        <label className="sms-toggle">
          <input
            type="checkbox"
            name="sms_enabled"
            defaultChecked={defaults.enabled}
          />
          <span className="sms-toggle-slider" />
        </label>
      </div>

      <div className="order-card">
        <strong style={{ display: "block", marginBottom: 12 }}>
          Notification types
        </strong>

        <div className="sms-toggle-row">
          <div>
            <strong>Order confirmations</strong>
            <div className="muted">Notify when an order is confirmed</div>
          </div>
          <label className="sms-toggle">
            <input
              type="checkbox"
              name="sms_order_confirmation"
              defaultChecked={defaults.orderConfirmation}
            />
            <span className="sms-toggle-slider" />
          </label>
        </div>

        <div className="sms-toggle-row">
          <div>
            <strong>Deposit reminders</strong>
            <div className="muted">Remind customers about pending deposits</div>
          </div>
          <label className="sms-toggle">
            <input
              type="checkbox"
              name="sms_deposit_reminder"
              defaultChecked={defaults.depositReminder}
            />
            <span className="sms-toggle-slider" />
          </label>
        </div>

        <div className="sms-toggle-row">
          <div>
            <strong>Delivery updates</strong>
            <div className="muted">
              Scheduled, en route, and completed notifications
            </div>
          </div>
          <label className="sms-toggle">
            <input
              type="checkbox"
              name="sms_delivery_updates"
              defaultChecked={defaults.deliveryUpdates}
            />
            <span className="sms-toggle-slider" />
          </label>
        </div>

        <div className="sms-toggle-row">
          <div>
            <strong>Payment confirmations</strong>
            <div className="muted">Confirm when a payment is received</div>
          </div>
          <label className="sms-toggle">
            <input
              type="checkbox"
              name="sms_payment_confirmation"
              defaultChecked={defaults.paymentConfirmation}
            />
            <span className="sms-toggle-slider" />
          </label>
        </div>

        <div className="sms-toggle-row">
          <div>
            <strong>Weather alerts</strong>
            <div className="muted">
              Notify about weather that may affect events
            </div>
          </div>
          <label className="sms-toggle">
            <input
              type="checkbox"
              name="sms_weather_alerts"
              defaultChecked={defaults.weatherAlerts}
            />
            <span className="sms-toggle-slider" />
          </label>
        </div>
      </div>

      <label className="order-card">
        <strong>SMS signature</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          Appended to every outgoing SMS (e.g. your business name or phone)
        </div>
        <input
          name="sms_signature"
          type="text"
          defaultValue={defaults.signature}
          placeholder="Bounce Back Rentals"
          maxLength={40}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      {state.message && (
        <div
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px" }}
        >
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save SMS Settings"}
        </button>
      </div>
    </form>
  );
}
