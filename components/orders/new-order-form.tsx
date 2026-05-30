"use client";

import { useActionState } from "react";
import { createOrder } from "@/lib/orders/actions";
import type {
  OrderFormProductOption,
  OrderFormServiceAreaOption,
} from "@/lib/data/order-form-options";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const initialState = { ok: false, message: "" };

export function NewOrderForm({
  products,
  serviceAreas,
  initialEventDate,
}: {
  products: OrderFormProductOption[];
  serviceAreas: OrderFormServiceAreaOption[];
  /** Pre-fill the event_date input — used by deep links from the route
      detail page's empty Add-Stop state ("Create order for this date"). */
  initialEventDate?: string;
}) {
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const { messages } = useI18n();
  const m = messages.forms.newOrder;

  const orderStatuses = [
    { value: "inquiry", label: m.statuses.inquiry },
    { value: "quote_sent", label: m.statuses.quoteSent },
    { value: "awaiting_deposit", label: m.statuses.awaitingDeposit },
    { value: "confirmed", label: m.statuses.confirmed },
    { value: "scheduled", label: m.statuses.scheduled },
  ];

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.firstNameLabel}</strong>
          <input
            name="first_name"
            type="text"
            required
            placeholder={m.firstNamePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.lastNameLabel}</strong>
          <input
            name="last_name"
            type="text"
            required
            placeholder={m.lastNamePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.phoneLabel}</strong>
          <input
            name="phone"
            type="tel"
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
          placeholder={m.emailPlaceholder}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.eventDateLabel}</strong>
          <input
            name="event_date"
            type="date"
            defaultValue={initialEventDate}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.startTimeLabel}</strong>
          <input
            name="start_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>{m.endTimeLabel}</strong>
          <input
            name="end_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>{m.rentalEndDateLabel}</strong>
        <input
          name="rental_end_date"
          type="date"
          style={{ marginTop: 10, width: "100%" }}
        />
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {m.rentalEndDateHelp}
        </div>
      </label>

      <label
        className="order-card"
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
      >
        <input
          name="sms_opt_in"
          type="checkbox"
          value="true"
          style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-soft)" }}>
          <strong style={{ color: "var(--text)" }}>{m.smsOptInTitle}</strong>
          <br />
          {m.smsOptInHelp}
        </span>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.orderStatusLabel}</strong>
          <select
            name="order_status"
            defaultValue="inquiry"
            style={{ marginTop: 10, width: "100%" }}
          >
            {orderStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>{m.productLabel}</strong>
          <select
            name="product_id"
            defaultValue=""
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="">{m.noProductSelected}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {formatMessage(m.productOption, {
                  name: product.name,
                  price: product.basePrice,
                })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.serviceAreaLabel}</strong>
          <select
            name="service_area_id"
            defaultValue=""
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="">{m.serviceAreaPlaceholder}</option>
            {serviceAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {formatMessage(m.serviceAreaOption, {
                  label: area.label,
                  fee: area.deliveryFee,
                  min: area.minimumOrderAmount,
                })}
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>{m.deliveryFeeLabel}</strong>
          <input
            name="delivery_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {m.deliveryFeeHelp}
          </div>
        </label>
        <label className="order-card">
          <strong>{m.subtotalLabel}</strong>
          <input
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {m.subtotalHelp}
          </div>
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.depositAmountLabel}</strong>
          <input
            name="deposit_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <div className="order-card">
          <strong>{m.totalLabel}</strong>
          <div className="muted" style={{ marginTop: 10 }}>
            {m.totalHelp}
          </div>
        </div>
      </div>

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>{m.deliveryAddressHeading}</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.streetAddressLabel}</span>
            <input
              name="delivery_line1"
              type="text"
              placeholder={m.streetAddressPlaceholder}
              style={{ width: "100%" }}
            />
          </label>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.aptSuiteLabel}</span>
            <input
              name="delivery_line2"
              type="text"
              placeholder={m.aptSuitePlaceholder}
              style={{ width: "100%" }}
            />
          </label>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.cityLabel}</span>
              <input name="delivery_city" type="text" placeholder={m.cityPlaceholder} style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.stateLabel}</span>
              <input name="delivery_state" type="text" placeholder={m.statePlaceholder} maxLength={3} style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.zipLabel}</span>
              <input name="delivery_zip" type="text" placeholder={m.zipPlaceholder} maxLength={10} style={{ width: "100%" }} />
            </label>
          </div>
        </div>
      </div>

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>{m.deliveryDetailsHeading}</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.surfaceTypeLabel}</span>
              <select name="delivery_surface_type" defaultValue="" style={{ width: "100%" }}>
                <option value="">{m.surfaces.notSpecified}</option>
                <option value="grass">{m.surfaces.grass}</option>
                <option value="concrete">{m.surfaces.concrete}</option>
                <option value="asphalt">{m.surfaces.asphalt}</option>
                <option value="other">{m.surfaces.other}</option>
              </select>
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.gateCodeLabel}</span>
              <input name="delivery_gate_code" type="text" placeholder={m.gateCodePlaceholder} style={{ width: "100%" }} />
            </label>
          </div>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.onSiteContactNameLabel}</span>
              <input name="delivery_contact_name" type="text" placeholder={m.onSiteContactNamePlaceholder} style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.onSiteContactPhoneLabel}</span>
              <input name="delivery_contact_phone" type="tel" placeholder={m.onSiteContactPhonePlaceholder} style={{ width: "100%" }} />
            </label>
          </div>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.setupNotesLabel}</span>
            <textarea
              name="delivery_setup_notes"
              placeholder={m.setupNotesPlaceholder}
              rows={2}
              style={{
                width: "100%",
                fontFamily: "inherit",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
              }}
            />
          </label>
        </div>
      </div>

      <label className="order-card">
        <strong>{m.internalNotesLabel}</strong>
        <textarea
          name="notes"
          placeholder={m.internalNotesPlaceholder}
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
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
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
      </div>
    </form>
  );
}
