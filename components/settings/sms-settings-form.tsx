"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateSmsSettings } from "@/lib/sms/actions";
import type { SmsSettings } from "@/lib/data/sms-settings";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function SmsSettingsForm({
  defaults,
  locked = false,
}: {
  defaults: SmsSettings;
  /** True when the org's plan doesn't include SMS — renders an upgrade
      notice and disables every control. */
  locked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateSmsSettings,
    initialState
  );
  const { messages } = useI18n();
  const m = messages.forms.smsSettings;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      {locked && (
        <div className="sms-pro-lock">
          <div>
            <strong>{m.proLockTitle}</strong>
            <p>{m.proLockBody}</p>
          </div>
          <Link href="/dashboard/settings/billing" className="primary-btn">
            {m.proLockCta}
          </Link>
        </div>
      )}
      <fieldset
        disabled={locked}
        style={{ border: 0, padding: 0, margin: 0, opacity: locked ? 0.55 : 1 }}
      >
      <div className="sms-toggle-row order-card">
        <div>
          <strong>{m.enableSmsTitle}</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            {m.enableSmsHelp}
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
          {m.notificationTypesHeading}
        </strong>

        <div className="sms-toggle-row">
          <div>
            <strong>{m.orderConfirmationTitle}</strong>
            <div className="muted">{m.orderConfirmationHelp}</div>
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
            <strong>{m.depositReminderTitle}</strong>
            <div className="muted">{m.depositReminderHelp}</div>
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
            <strong>{m.deliveryUpdatesTitle}</strong>
            <div className="muted">
              {m.deliveryUpdatesHelp}
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
            <strong>{m.paymentConfirmationTitle}</strong>
            <div className="muted">{m.paymentConfirmationHelp}</div>
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
            <strong>{m.weatherAlertsTitle}</strong>
            <div className="muted">
              {m.weatherAlertsHelp}
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
        <strong>{m.signatureLabel}</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          {m.signatureHelp}
        </div>
        <input
          name="sms_signature"
          type="text"
          defaultValue={defaults.signature}
          placeholder={m.signaturePlaceholder}
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
          {pending ? m.submitting : m.submit}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
