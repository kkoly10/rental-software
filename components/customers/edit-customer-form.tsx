"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { updateCustomer, type CustomerActionState } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";

const initialState: CustomerActionState = { ok: false, message: "" };

export function EditCustomerForm({ customer }: { customer: CustomerDetail }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCustomer, initialState);
  const { messages } = useI18n();
  const m = messages.forms.editCustomer;

  useEffect(() => {
    if (state.ok && state.message) {
      setEditing(false);
    }
  }, [state.ok, state.message]);

  if (!editing) {
    return (
      <button
        type="button"
        className="secondary-btn"
        onClick={() => setEditing(true)}
        style={{ fontSize: 13 }}
      >
        {m.editCustomer}
      </button>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="customer_id" value={customer.id} />

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.firstNameLabel}</strong>
          <input
            name="first_name"
            type="text"
            required
            defaultValue={customer.firstName}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.lastNameLabel}</strong>
          <input
            name="last_name"
            type="text"
            required
            defaultValue={customer.lastName}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.phoneLabel}</strong>
          <input
            name="phone"
            type="tel"
            defaultValue={customer.phone}
            placeholder={m.phonePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>{m.emailLabel}</strong>
        <input
          name="email"
          type="email"
          defaultValue={customer.email}
          placeholder={m.emailPlaceholder}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Preferred language</strong>
        <span
          className="muted"
          style={{ display: "block", fontSize: 12, marginTop: 2 }}
        >
          Used for SMS and email templates sent to this customer.
        </span>
        <select
          name="preferred_locale"
          defaultValue={customer.preferredLocale || "en"}
          style={{ marginTop: 10, width: "100%" }}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
        </select>
      </label>

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>{m.savedAddressLabel}</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
              {m.streetAddressLabel}
            </span>
            <input
              name="address_line1"
              type="text"
              defaultValue={customer.addressLine1}
              placeholder={m.streetAddressPlaceholder}
              style={{ width: "100%" }}
            />
          </label>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
              {m.aptSuiteLabel}
            </span>
            <input
              name="address_line2"
              type="text"
              defaultValue={customer.addressLine2}
              placeholder={m.aptSuitePlaceholder}
              style={{ width: "100%" }}
            />
          </label>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                {m.cityLabel}
              </span>
              <input
                name="address_city"
                type="text"
                defaultValue={customer.addressCity}
                placeholder={m.cityPlaceholder}
                style={{ width: "100%" }}
              />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                {m.stateLabel}
              </span>
              <input
                name="address_state"
                type="text"
                defaultValue={customer.addressState}
                placeholder={m.statePlaceholder}
                maxLength={3}
                style={{ width: "100%" }}
              />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                {m.zipLabel}
              </span>
              <input
                name="address_zip"
                type="text"
                defaultValue={customer.addressZip}
                placeholder={m.zipPlaceholder}
                maxLength={10}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
      </div>

      <label className="order-card">
        <strong>{m.notesLabel}</strong>
        <textarea
          name="notes"
          defaultValue={customer.notes}
          placeholder={m.notesPlaceholder}
          rows={3}
          style={{
            marginTop: 10,
            width: "100%",
            fontFamily: "inherit",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
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

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          {m.cancel}
        </button>
      </div>
    </form>
  );
}
