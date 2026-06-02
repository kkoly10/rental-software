"use client";

import { useActionState } from "react";
import { updateEmailSettings } from "@/lib/email/settings-actions";
import type { SettingsActionState } from "@/lib/settings/actions";
import type { EmailSettings } from "@/lib/data/email-settings";

const initial: SettingsActionState = { ok: false, message: "" };

const ROWS: Array<{ name: string; label: string; description: string; field: keyof EmailSettings }> = [
  {
    name: "email_payment_received",
    label: "Payment received",
    description: "Customer paid via Stripe portal.",
    field: "paymentReceived",
  },
  {
    name: "email_refund_processed",
    label: "Refund processed",
    description: "Stripe issued a refund on an order.",
    field: "refundProcessed",
  },
  {
    name: "email_document_signed",
    label: "Document signed",
    description: "Customer signed an agreement or waiver.",
    field: "documentSigned",
  },
  {
    name: "email_quote_accepted",
    label: "Quote accepted",
    description: "Customer accepted a quote on the portal.",
    field: "quoteAccepted",
  },
  {
    name: "email_order_cancelled",
    label: "Order cancelled",
    description: "Customer cancelled a booking from the portal.",
    field: "orderCancelled",
  },
  {
    name: "email_portal_message",
    label: "Portal message",
    description: "Customer sent a message through the order portal.",
    field: "portalMessage",
  },
];

export function EmailNotificationsCard({ defaults }: { defaults: EmailSettings }) {
  const [state, action, pending] = useActionState(updateEmailSettings, initial);

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="section-header">
        <div>
          <div className="kicker">Operator notifications</div>
          <h2 style={{ margin: "6px 0 0" }}>Email alerts</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Choose which customer-initiated events email your operator inbox. Disabling a
            category here still leaves the in-app notification (bell icon) in place.
          </div>
        </div>
      </div>

      <form action={action} className="list" style={{ marginTop: 14 }}>
        {ROWS.map((row) => (
          <label
            key={row.name}
            className="order-card"
            style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              name={row.name}
              defaultChecked={defaults[row.field]}
              style={{ marginTop: 3 }}
            />
            <span style={{ flex: 1 }}>
              <strong style={{ display: "block" }}>{row.label}</strong>
              <span className="muted" style={{ fontSize: 13 }}>{row.description}</span>
            </span>
          </label>
        ))}

        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            aria-live={state.ok ? "polite" : "assertive"}
            className={state.ok ? "badge success" : "badge warning"}
            style={{ padding: "10px 14px" }}
          >
            {state.message}
          </div>
        )}

        <div>
          <button className="primary-btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save email preferences"}
          </button>
        </div>
      </form>
    </section>
  );
}
