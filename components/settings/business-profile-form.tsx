"use client";

import { useActionState } from "react";
import { updateBusinessProfile } from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function BusinessProfileForm({
  defaults,
}: {
  defaults: {
    name: string;
    supportEmail: string;
    phone: string;
    timezone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    representativeName: string;
  };
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

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 4 }}>
          {m.documentDetailsLegend}
        </legend>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          {m.documentDetailsHelp}
        </p>

        <label className="order-card">
          <strong>{m.addressLine1Label}</strong>
          <input name="business_address_line1" type="text" defaultValue={defaults.addressLine1} placeholder={m.addressLine1Placeholder} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card" style={{ marginTop: 12 }}>
          <strong>{m.addressLine2Label}</strong>
          <input name="business_address_line2" type="text" defaultValue={defaults.addressLine2} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="order-card">
            <strong>{m.cityLabel}</strong>
            <input name="business_city" type="text" defaultValue={defaults.city} style={{ marginTop: 8, width: "100%" }} />
          </label>
          <label className="order-card">
            <strong>{m.stateLabel}</strong>
            <input name="business_state" type="text" defaultValue={defaults.state} style={{ marginTop: 8, width: "100%" }} />
          </label>
          <label className="order-card">
            <strong>{m.postalCodeLabel}</strong>
            <input name="business_postal_code" type="text" defaultValue={defaults.postalCode} style={{ marginTop: 8, width: "100%" }} />
          </label>
        </div>

        <label className="order-card" style={{ marginTop: 12 }}>
          <strong>{m.representativeNameLabel}</strong>
          <input name="business_representative_name" type="text" defaultValue={defaults.representativeName} placeholder={m.representativeNamePlaceholder} style={{ marginTop: 8, width: "100%" }} />
          <span className="muted" style={{ display: "block", marginTop: 6, fontSize: 12 }}>{m.representativeNameHelp}</span>
        </label>
      </fieldset>

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
