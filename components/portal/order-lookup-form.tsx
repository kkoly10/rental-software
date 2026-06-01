"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { lookupOrder, type PortalLookupState } from "@/lib/portal/lookup";
import { OrderTimeline } from "./order-timeline";
import { DocumentSign } from "./document-sign";
import { CustomerMessageForm } from "./customer-message-form";
import { InvoiceDownload } from "./invoice-download";
import { PayBalanceButton } from "./pay-balance-button";
import { CancelBookingButton } from "./cancel-booking-button";
import { AcceptQuoteButton } from "./accept-quote-button";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

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
  const { messages: m } = useI18n();
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
            <label className="field-stack">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.lookup.orderNumber}</span>
              <input
                name="order_number"
                type="text"
                placeholder={m.portal.lookup.orderNumberPlaceholder}
                required
                style={{ textTransform: "uppercase" }}
              />
            </label>

            <label className="field-stack">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.lookup.email}</span>
              <input
                name="email"
                type="email"
                placeholder={m.portal.lookup.emailPlaceholder}
                required
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
              />
            </label>

            <button type="submit" className="primary-btn" disabled={pending}>
              {pending ? m.portal.lookup.lookingUp : m.portal.lookup.submit}
            </button>
          </div>

          {!state.ok && state.message && (
            <div role="alert" aria-live="assertive" className="badge warning" style={{ marginTop: 12 }}>
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
                <div className="kicker">{formatMessage(m.portal.order.orderLabel, { value: state.order.orderNumber })}</div>
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
                <strong>{m.portal.order.deliveryInformation}</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  <div className="order-row">
                    <span className="muted">{m.portal.order.deliveryDate}</span>
                    <span>{state.order.deliveryDate}</span>
                  </div>
                  {state.order.deliveryTimeWindow && (
                    <div className="order-row">
                      <span className="muted">{m.portal.order.timeWindow}</span>
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
              {m.portal.order.checkWeather}
            </div>

            <div className="list" style={{ marginTop: 12 }}>
              <div className="order-card">
                <strong>{m.portal.order.rentalItems}</strong>
                <div className="muted">{state.order.items.join(" · ") || "—"}</div>
              </div>

              <div className="order-card">
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="order-row">
                    <span className="muted">{m.portal.order.subtotal}</span>
                    <span>{state.order.subtotal}</span>
                  </div>
                  <div className="order-row">
                    <span className="muted">{m.portal.order.deliveryFee}</span>
                    <span>{state.order.deliveryFee}</span>
                  </div>
                  <div className="order-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <strong>{m.portal.order.total}</strong>
                    <strong>{state.order.total}</strong>
                  </div>
                  <div className="order-row">
                    <span className="muted">{m.portal.order.depositRequired}</span>
                    <span>{state.order.depositDue}</span>
                  </div>
                  <div className="order-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <strong style={{ color: "var(--primary)" }}>{m.portal.order.balanceDue}</strong>
                    <strong style={{ color: "var(--primary)" }}>{state.order.balanceDue}</strong>
                  </div>
                </div>
              </div>
            </div>

            {state.order.status === "Quote Sent" && (
              <div style={{ marginTop: 16 }}>
                <AcceptQuoteButton portalToken={activeToken} />
              </div>
            )}

            {state.order.payments.length > 0 && (
              <div className="order-card" style={{ marginTop: 12 }}>
                <strong>{m.portal.order.paymentHistory}</strong>
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {state.order.payments.map((p, i) => (
                    <div key={i} className="order-row" style={{ fontSize: 13 }}>
                      <span className="muted">{p.date} · {p.type}</span>
                      <span>{p.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="action-row-end" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <InvoiceDownload order={state.order} />
              {state.order.status !== "Quote Sent" && state.order.status !== "Inquiry" && (
                <PayBalanceButton portalToken={activeToken} balanceDue={state.order.balanceDue} />
              )}
              <CancelBookingButton portalToken={activeToken} currentStatus={state.order.status} />
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
