"use client";

import { useActionState } from "react";
import {
  updateCustomerWhatsAppPreferences,
  type CustomerActionState,
} from "@/lib/customers/actions";

const initial: CustomerActionState = { ok: false, message: "" };

/**
 * Sprint 4.5 — operator-facing toggle for the customer's WhatsApp
 * preferences. Mounted on the customer detail page below the address
 * card.
 *
 * Two inputs:
 *   - `whatsapp_opted_in` checkbox: whether the customer wants
 *     WhatsApp notifications instead of SMS where available
 *   - `whatsapp_number` text field: optional override when the
 *     WhatsApp number differs from the primary phone. Empty = fall
 *     back to phone.
 *
 * Customer-facing self-service opt-in (an SMS "Reply YES" flow that
 * lets the customer flip this themselves) is the next slice of
 * Sprint 4.5 — for now the operator toggles per customer based on
 * conversation. This already closes the immediate gap where the only
 * way to opt anyone in was via the SQL editor.
 */
export function WhatsAppPreferencesForm({
  customerId,
  defaults,
}: {
  customerId: string;
  defaults: { optedIn: boolean; whatsappNumber: string };
}) {
  const [state, action, pending] = useActionState(
    updateCustomerWhatsAppPreferences,
    initial,
  );

  return (
    <form action={action} className="stack-gap">
      <input type="hidden" name="customer_id" value={customerId} />

      <label
        className="order-card"
        style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
      >
        <input
          type="checkbox"
          name="whatsapp_opted_in"
          defaultChecked={defaults.optedIn}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          <strong>Send notifications over WhatsApp</strong>
          <div
            className="muted"
            style={{ fontSize: 13, marginTop: 4 }}
          >
            When on, this customer receives order confirmations and
            delivery updates via WhatsApp where a Meta-approved template
            exists. Falls back to SMS automatically when WhatsApp isn't
            available.
          </div>
        </div>
      </label>

      <label
        className="order-card"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <strong>WhatsApp number (optional)</strong>
        <div className="muted" style={{ fontSize: 13 }}>
          Only set this when the customer uses a different number on
          WhatsApp than their primary phone. Leave blank to use their
          phone number.
        </div>
        <input
          type="text"
          name="whatsapp_number"
          defaultValue={defaults.whatsappNumber}
          placeholder="+14155551234"
          style={{ maxWidth: 280 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Saving…" : "Save WhatsApp preferences"}
        </button>
        {state.message && (
          <span
            className={state.ok ? "badge success" : "badge warning"}
            style={{ fontSize: 12, maxWidth: 380 }}
            role={state.ok ? undefined : "alert"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
