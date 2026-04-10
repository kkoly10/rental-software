"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { lookupOrder, type PortalLookupState } from "@/lib/portal/lookup";
import { OrderTimeline } from "./order-timeline";
import { DocumentSign } from "./document-sign";
import { CustomerMessageForm } from "./customer-message-form";
import { InvoiceDownload } from "./invoice-download";

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

const DELIVERY_STATUSES = ["Scheduled", "Out for Delivery", "Delivered"];

type Props = {
  initialState?: PortalLookupState;
};

export function OrderLookupForm({ initialState }: Props) {
  const [state, formAction, pending] = useActionState<PortalLookupState, FormData>(
    lookupOrder,
    initialState ?? { ok: true, message: "" }
  );
  const [lookupEmail, setLookupEmail] = useState("");

  const activeToken = useMemo(() => state.portalToken ?? "", [state.portalToken]);

  const hasPortalResult = Boolean(state.ok && state.order && activeToken);

  return (
    <div>
      {!hasPortalResult && (
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
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
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
      )}

      {state.ok && state.order && activeToken && (
        <>
          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Order #{state.order.orderNumber}</div>
                <h2 style={{ margin: "6px 0 0" }}>{state.order.eventDate}</h2>
                {state.order.customerName && (
                  <div className="muted" style={{ marginTop: 4 }}>{state.order.customerName}</div>
                )}
              </div>
              <span className={`badge ${statusTones[state.order.status] ?? "default"}`}>
                {state.order.status}
              </span>
            </div>

            <div style={{ marginTop: 20 }}>
              <OrderTimeline currentStatus={state.order.status} />
            </div>

            {DELIVERY_STATUSES.includes(state.order.status) && state.order.deliveryDate && (
              <div className="portal-delivery-card" style={{ marginTop: 16 }}>
                <strong>Delivery Information</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  <div className="order-row">
                    <span className="muted">Delivery date</span>
                    <span>{state.order.deliveryDate}</span>
                  </div>
                  {state.order.deliveryTimeWindow && (
                    <div className="order-row">
                      <span className="muted">Time window</span>
                      <span>{state.order.deliveryTimeWindow}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "var(--surface-muted)",
              borderRadius: 12,
              fontSize: 13,
              color: "var(--text-soft)",
            }}>
              Check weather for your event day
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
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <InvoiceDownload order={state.order} />
            </div>
          </div>

          {state.order.documents.length > 0 && (
            <DocumentSign
              documents={state.order.documents}
              portalToken={activeToken}
            />
          )}

          <CustomerMessageForm portalToken={activeToken} />
        </>
      )}
    </div>
  );
}
