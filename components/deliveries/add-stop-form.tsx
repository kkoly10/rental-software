"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addOrderToRoute, type RouteActionState } from "@/lib/routes/actions";
import type {
  UnroutedOrder,
  BlockedOrder,
} from "@/lib/data/unrouted-orders";
import { useI18n } from "@/lib/i18n/provider";

const initial: RouteActionState = { ok: false, message: "" };

export function AddStopForm({
  routeId,
  routeDate,
  eligibleOrders,
  blockedOrders,
}: {
  routeId: string;
  routeDate: string;
  eligibleOrders: UnroutedOrder[];
  blockedOrders: BlockedOrder[];
}) {
  const { messages } = useI18n();
  const t = messages.forms.routing.addStop;
  const [state, action, pending] = useActionState(addOrderToRoute, initial);

  // ─── Diagnostic empty state ────────────────────────────────────────────
  // When the eligible dropdown is empty we replace the dead "No confirmed
  // orders without a route for this date." with concrete next steps:
  // either an order-create CTA (no orders exist at all) or a list of
  // blocked orders, each with the missing prereq named and a deep link
  // to fix it.
  if (eligibleOrders.length === 0) {
    if (blockedOrders.length === 0) {
      return (
        <div className="add-stop-empty">
          <div className="add-stop-empty-headline">{t.empty.noOrdersTitle}</div>
          <div className="add-stop-empty-body">
            {t.empty.noOrdersBody.replace("{date}", routeDate)}
          </div>
          <Link
            href={`/dashboard/orders/new?event_date=${routeDate}`}
            className="primary-btn"
            style={{ marginTop: 10, display: "inline-block" }}
          >
            {t.empty.createOrderCta}
          </Link>
        </div>
      );
    }

    return (
      <div className="add-stop-empty">
        <div className="add-stop-empty-headline">
          {t.empty.blockedTitle.replace("{count}", String(blockedOrders.length))}
        </div>
        <div className="add-stop-empty-body">{t.empty.blockedBody}</div>
        <ul className="add-stop-blocked-list">
          {blockedOrders.map((o) => (
            <li key={o.id} className="add-stop-blocked-row">
              <div className="add-stop-blocked-row-main">
                <div className="add-stop-blocked-row-title">
                  #{o.orderNumber} — {o.customerName}{" "}
                  <span className="muted" style={{ fontSize: 12 }}>
                    ({o.productName})
                  </span>
                </div>
                <div className="add-stop-blocked-row-reason">
                  {reasonText(o, t)}
                </div>
              </div>
              <Link
                href={`/dashboard/orders/${o.id}`}
                className="secondary-btn add-stop-blocked-row-cta"
              >
                {ctaForReason(o.reason, t)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ─── Happy path: eligible dropdown ─────────────────────────────────────
  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="route_id" value={routeId} />
      <input type="hidden" name="route_date" value={routeDate} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 180px" }}>
          <label htmlFor="add-stop-order" style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {t.orderLabel}
          </label>
          <select id="add-stop-order" name="order_id" required style={{ width: "100%" }}>
            <option value="">{t.selectOrder}</option>
            {eligibleOrders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.orderNumber} — {o.customerName} ({o.productName})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label htmlFor="add-stop-type" style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {t.stopTypeLabel}
          </label>
          <select id="add-stop-type" name="stop_type" style={{ width: "100%" }}>
            <option value="delivery">{t.stopTypes.delivery}</option>
            <option value="pickup">{t.stopTypes.pickup}</option>
          </select>
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label htmlFor="add-stop-time" style={{ fontSize: 12, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>
            {t.timeLabel}
          </label>
          <input id="add-stop-time" name="scheduled_time" type="time" style={{ width: "100%" }} />
        </div>

        <button type="submit" className="secondary-btn" disabled={pending} style={{ flexShrink: 0 }}>
          {pending ? t.submitting : t.submit}
        </button>
      </div>

      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
          className={`badge ${state.ok ? "success" : "warning"}`}
          style={{ marginTop: 8, padding: "6px 10px", fontSize: 13 }}
        >
          {state.message}
        </div>
      )}

      {blockedOrders.length > 0 && (
        // Eligible orders are present AND some others are blocked.  Surface
        // the count under the form so the operator knows they could route
        // more if they fixed prereqs.
        <div className="add-stop-blocked-hint">
          {t.empty.blockedTitle.replace("{count}", String(blockedOrders.length))}{" "}
          <span className="muted">{t.empty.blockedHintTail}</span>
        </div>
      )}
    </form>
  );
}

type AddStopT = ReturnType<typeof useI18n>["messages"]["forms"]["routing"]["addStop"];

function ctaForReason(reason: BlockedOrder["reason"], t: AddStopT): string {
  switch (reason) {
    case "not_confirmed":
      return t.empty.fixCta.confirm;
    case "no_address":
      return t.empty.fixCta.addAddress;
    case "on_other_route":
      return t.empty.fixCta.viewOrder;
  }
}

function reasonText(o: BlockedOrder, t: AddStopT): string {
  switch (o.reason) {
    case "not_confirmed":
      return t.empty.reason.notConfirmed.replace(
        "{status}",
        humanStatus(o.currentStatus, t)
      );
    case "no_address":
      return t.empty.reason.noAddress;
    case "on_other_route":
      return t.empty.reason.onOtherRoute;
  }
}

function humanStatus(status: string, t: AddStopT): string {
  const map: Record<string, string> = {
    inquiry: t.empty.statusLabels.inquiry,
    quote_sent: t.empty.statusLabels.quoteSent,
    awaiting_deposit: t.empty.statusLabels.awaitingDeposit,
    confirmed: t.empty.statusLabels.confirmed,
    scheduled: t.empty.statusLabels.scheduled,
  };
  return map[status] ?? status;
}
