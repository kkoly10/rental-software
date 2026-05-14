"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { updateCustomer, type CustomerActionState } from "@/lib/customers/actions";
import type { CustomerDetail } from "@/lib/types";

const initialState: CustomerActionState = { ok: false, message: "" };

export function EditCustomerForm({ customer }: { customer: CustomerDetail }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCustomer, initialState);

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
        Edit customer
      </button>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="customer_id" value={customer.id} />

      <div className="grid grid-3">
        <label className="order-card">
          <strong>First name</strong>
          <input
            name="first_name"
            type="text"
            required
            defaultValue={customer.firstName}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>Last name</strong>
          <input
            name="last_name"
            type="text"
            required
            defaultValue={customer.lastName}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>Phone</strong>
          <input
            name="phone"
            type="tel"
            defaultValue={customer.phone}
            placeholder="(540) 555-0100"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>Email</strong>
        <input
          name="email"
          type="email"
          defaultValue={customer.email}
          placeholder="customer@example.com"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>Saved address</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
              Street address
            </span>
            <input
              name="address_line1"
              type="text"
              defaultValue={customer.addressLine1}
              placeholder="123 Main St"
              style={{ width: "100%" }}
            />
          </label>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
              Apt / Suite / Unit (optional)
            </span>
            <input
              name="address_line2"
              type="text"
              defaultValue={customer.addressLine2}
              placeholder="Apt 4B"
              style={{ width: "100%" }}
            />
          </label>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                City
              </span>
              <input
                name="address_city"
                type="text"
                defaultValue={customer.addressCity}
                placeholder="Springfield"
                style={{ width: "100%" }}
              />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                State
              </span>
              <input
                name="address_state"
                type="text"
                defaultValue={customer.addressState}
                placeholder="VA"
                maxLength={3}
                style={{ width: "100%" }}
              />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>
                ZIP
              </span>
              <input
                name="address_zip"
                type="text"
                defaultValue={customer.addressZip}
                placeholder="22150"
                maxLength={10}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
      </div>

      <label className="order-card">
        <strong>Notes</strong>
        <textarea
          name="notes"
          defaultValue={customer.notes}
          placeholder="Internal notes about this customer."
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
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
