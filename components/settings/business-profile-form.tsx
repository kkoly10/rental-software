"use client";

import { useActionState } from "react";
import { updateBusinessProfile } from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function BusinessProfileForm({
  defaults,
}: {
  defaults: { name: string; supportEmail: string; phone: string; timezone: string };
}) {
  const [state, formAction, pending] = useActionState(updateBusinessProfile, initialState);
  const { messages } = useI18n();
  const m = messages.forms.businessProfile;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>{m.businessNameLabel}</strong>
        <input name="name" type="text" defaultValue={defaults.name} required style={{ marginTop: 8, width: "100%" }} />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.supportEmailLabel}</strong>
          <input name="support_email" type="email" defaultValue={defaults.supportEmail} placeholder={m.supportEmailPlaceholder} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>{m.phoneLabel}</strong>
          <input name="phone" type="tel" defaultValue={defaults.phone} placeholder={m.phonePlaceholder} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>{m.timezoneLabel}</strong>
          <select name="timezone" defaultValue={defaults.timezone} style={{ marginTop: 8, width: "100%" }}>
            <option value="America/New_York">{m.timezones.eastern}</option>
            <option value="America/Chicago">{m.timezones.central}</option>
            <option value="America/Denver">{m.timezones.mountain}</option>
            <option value="America/Los_Angeles">{m.timezones.pacific}</option>
          </select>
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}
