"use client";

import { useActionState } from "react";
import { lookupOrder, type PortalLookupState } from "@/lib/portal/lookup";

const statusTones: Record<string, string> = {
  Confirmed: "success",
  Completed: "success",
  Delivered: "success",
  "Out for Delivery": "default",
  Scheduled: "default",
  "Awaiting Deposit": "warning",
  "Quote Sent": "warning",
  Inquiry: "warning",
  Cancelled: "danger",
};

export function OrderLookupForm() {
  const [state, formAction, pending] = useActionState<PortalLookupState, FormData>(
    lookupOrder,
    { ok: true, message: "" }
  );

  return (
    <div>
      <form action={formAction} className="panel" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Order number</span>
            <input
              name="order_number"
              type="text"
              placeholder="ORD-2401"
              required
              style={{ textTransform: "uppercase" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Email address</span>
            <input
              name="email"
              type="email"
              placeholder="your@email.com"
              required
            />
          </label>

          <button type="submit" className="primary-btn" disabled={pending}>
            {pending ? "Looking up..." : "Look Up Order"}
          </button>
        </div>

        {!state.ok && state.message && (
          <div className="badge warning" style={{ marginTop: 12 }}>
            {state.message}
          </div>
        )}
      </form>

      {state.ok && state.order && (
        <div className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Order #{state.order.orderNumber}</div>
              <h2 style={{ margin: "6px 0 0" }}>{state.order.eventDate}</h2>
            </div>
            <span className={`badge ${statusTones[state.order.status] ?? "default"}`}>
              {state.order.status}
            </span>
          </div>

          <div className="list" style={{ marginTop: 12 }}>
            <div className="order-card">
              <strong>Rental items</strong>
              <div className="muted">{state.order.items.join(" · ") || "—"}</div>
            </div>

            <div className="order-card">
              <div style={{ display: "grid", gap: 6 }}>
                <div className="order-row">
                  <span className="muted">Subtotal</span>
                  <span>{state.order.subtotal}</span>
                </div>
                <div className="order-row">
                  <span className="muted">Delivery fee</span>
                  <span>{state.order.deliveryFee}</span>
                </div>
                <div className="order-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                  <strong>Total</strong>
                  <strong>{state.order.total}</strong>
                </div>
                <div className="order-row">
                  <span className="muted">Deposit required</span>
                  <span>{state.order.depositDue}</span>
                </div>
                <div className="order-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                  <strong style={{ color: "var(--primary)" }}>Balance due</strong>
                  <strong style={{ color: "var(--primary)" }}>{state.order.balanceDue}</strong>
                </div>
              </div>
            </div>

            {state.order.documents.length > 0 && (
              <div className="order-card">
                <strong>Documents</strong>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {state.order.documents.map((doc) => (
                    <span
                      key={doc.type}
                      className={`badge ${doc.status === "signed" ? "success" : "warning"}`}
                    >
                      {doc.type}: {doc.status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
