"use client";

import { useActionState, useEffect, useState } from "react";
import { createOrder, type OrderActionState } from "@/lib/orders/actions";
import type {
  OrderFormProductOption,
  OrderFormServiceAreaOption,
} from "@/lib/data/order-form-options";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const initialState: OrderActionState = { ok: false, message: "" };

// Render an inline field-level error message right under its input.
// Mirrors the checkout-form pattern so operators get the same "this
// field needs attention" affordance customers do on the storefront.
function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      className="badge warning"
      style={{
        marginTop: 6,
        padding: "4px 8px",
        fontSize: 12,
        display: "inline-block",
      }}
    >
      {message}
    </div>
  );
}

export function NewOrderForm({
  products,
  serviceAreas,
  initialEventDate,
  isGeneral,
}: {
  products: OrderFormProductOption[];
  serviceAreas: OrderFormServiceAreaOption[];
  /** Pre-fill the event_date input — used by deep links from the route
      detail page's empty Add-Stop state ("Create order for this date"). */
  initialEventDate?: string;
  /** General ("other") vertical → "Rental date" label. Event verticals unset. */
  isGeneral?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const { messages } = useI18n();
  const m = messages.forms.newOrder;
  const dateLabel = isGeneral ? m.eventDateLabelGeneral : m.eventDateLabel;
  // Convenient handle for inline field error rendering — populated by
  // createOrder on validation failure so each input can show its own
  // message instead of relying solely on the top-of-form toast.
  const fe = state.fieldErrors;
  // Echoed-back form values so the operator's inputs survive a failed
  // submit. Hydrating from sv on first render covers SSR; useEffect
  // below re-syncs whenever a fresh action result arrives. Same
  // approach as components/checkout/checkout-form.tsx — React 19's
  // <form action> reset semantics for uncontrolled inputs aren't
  // reliable across the Next server-action path, so controlled inputs
  // are the only way to guarantee the typed values stay put.
  const sv = state.submittedValues;
  const [firstName, setFirstName] = useState(sv?.firstName ?? "");
  const [lastName, setLastName] = useState(sv?.lastName ?? "");
  const [phone, setPhone] = useState(sv?.phone ?? "");
  const [email, setEmail] = useState(sv?.email ?? "");
  const [subtotal, setSubtotal] = useState(sv?.subtotal ?? "");
  const [deliveryFee, setDeliveryFee] = useState(sv?.deliveryFee ?? "");
  const [depositAmount, setDepositAmount] = useState(sv?.depositAmount ?? "");
  const [deliveryLine1, setDeliveryLine1] = useState(sv?.deliveryLine1 ?? "");
  const [deliveryLine2, setDeliveryLine2] = useState(sv?.deliveryLine2 ?? "");
  const [deliveryCity, setDeliveryCity] = useState(sv?.deliveryCity ?? "");
  const [deliveryStateField, setDeliveryStateField] = useState(sv?.deliveryState ?? "");
  const [deliveryZip, setDeliveryZip] = useState(sv?.deliveryZip ?? "");
  const [deliveryGateCode, setDeliveryGateCode] = useState(sv?.deliveryGateCode ?? "");
  const [deliveryContactName, setDeliveryContactName] = useState(sv?.deliveryContactName ?? "");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState(sv?.deliveryContactPhone ?? "");
  const [deliverySetupNotes, setDeliverySetupNotes] = useState(sv?.deliverySetupNotes ?? "");
  const [notes, setNotes] = useState(sv?.notes ?? "");

  useEffect(() => {
    if (!state.submittedValues) return;
    const v = state.submittedValues;
    if (v.firstName !== undefined) setFirstName(v.firstName);
    if (v.lastName !== undefined) setLastName(v.lastName);
    if (v.phone !== undefined) setPhone(v.phone);
    if (v.email !== undefined) setEmail(v.email);
    if (v.subtotal !== undefined) setSubtotal(v.subtotal);
    if (v.deliveryFee !== undefined) setDeliveryFee(v.deliveryFee);
    if (v.depositAmount !== undefined) setDepositAmount(v.depositAmount);
    if (v.deliveryLine1 !== undefined) setDeliveryLine1(v.deliveryLine1);
    if (v.deliveryLine2 !== undefined) setDeliveryLine2(v.deliveryLine2);
    if (v.deliveryCity !== undefined) setDeliveryCity(v.deliveryCity);
    if (v.deliveryState !== undefined) setDeliveryStateField(v.deliveryState);
    if (v.deliveryZip !== undefined) setDeliveryZip(v.deliveryZip);
    if (v.deliveryGateCode !== undefined) setDeliveryGateCode(v.deliveryGateCode);
    if (v.deliveryContactName !== undefined) setDeliveryContactName(v.deliveryContactName);
    if (v.deliveryContactPhone !== undefined) setDeliveryContactPhone(v.deliveryContactPhone);
    if (v.deliverySetupNotes !== undefined) setDeliverySetupNotes(v.deliverySetupNotes);
    if (v.notes !== undefined) setNotes(v.notes);
    if (v.orderStatus !== undefined && v.orderStatus !== "") setOrderStatus(v.orderStatus);
    if (v.productId !== undefined) setProductId(v.productId);
    if (v.serviceAreaId !== undefined) setServiceAreaId(v.serviceAreaId);
    if (v.deliverySurfaceType !== undefined) setDeliverySurfaceType(v.deliverySurfaceType);
  }, [state.submittedValues]);

  // Selects + checkbox: also controlled so a failed submit doesn't
  // reset the operator's choice along with the text fields.
  const [orderStatus, setOrderStatus] = useState(sv?.orderStatus && sv.orderStatus !== "" ? sv.orderStatus : "inquiry");
  const [productId, setProductId] = useState(sv?.productId ?? "");
  const [serviceAreaId, setServiceAreaId] = useState(sv?.serviceAreaId ?? "");
  const [deliverySurfaceType, setDeliverySurfaceType] = useState(sv?.deliverySurfaceType ?? "");
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Idempotency key — generated once when the form mounts so a
  // double-click / network retry doesn't create a duplicate order.
  // See orders.idempotency_key migration + createOrder server action.
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  });

  // `min` on the event_date <input> stops operators from accidentally
  // booking yesterday. Deferred to a post-mount effect so the SSR
  // pass (which runs in UTC) and the hydration pass (which runs in
  // the user's local timezone) don't disagree on `todayIso` and
  // produce a React hydration warning. Until the effect fires, the
  // input has no `min` — acceptable trade-off vs. the alternative of
  // computing the date on the server and threading it through props
  // for a value that's only used as a soft client-side guard. If the
  // form was deep-linked with an already-past initialEventDate we
  // leave minEventDate unset so the prefilled value still validates.
  const [minEventDate, setMinEventDate] = useState<string | undefined>(undefined);

  // Track the event/rental dates and times for client-side validation
  // (issue #1 from the post-launch follow-up: operator can silently submit
  // a same-day rental with start_time == end_time, producing two stops
  // with identical scheduled windows). Seed from sv on first render so
  // they also survive a failed-submit round-trip alongside the other
  // controlled inputs above.
  const [eventDate, setEventDate] = useState(sv?.eventDate ?? initialEventDate ?? "");
  const [rentalEndDate, setRentalEndDate] = useState(sv?.rentalEndDate ?? "");
  const [startTime, setStartTime] = useState(sv?.startTime ?? "");
  const [endTime, setEndTime] = useState(sv?.endTime ?? "");
  // Resync the date/time controls when a new sv arrives on error.
  useEffect(() => {
    if (!state.submittedValues) return;
    const v = state.submittedValues;
    if (v.eventDate !== undefined) setEventDate(v.eventDate);
    if (v.rentalEndDate !== undefined) setRentalEndDate(v.rentalEndDate);
    if (v.startTime !== undefined) setStartTime(v.startTime);
    if (v.endTime !== undefined) setEndTime(v.endTime);
  }, [state.submittedValues]);
  const sameDay =
    eventDate.length === 10 && rentalEndDate.length === 10 && eventDate === rentalEndDate;
  const timeClash =
    sameDay && startTime.length === 5 && endTime.length === 5 && startTime === endTime;
  useEffect(() => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setMinEventDate(
      initialEventDate && initialEventDate < todayIso ? undefined : todayIso,
    );
  }, [initialEventDate]);

  const orderStatuses = [
    { value: "inquiry", label: m.statuses.inquiry },
    { value: "quote_sent", label: m.statuses.quoteSent },
    { value: "awaiting_deposit", label: m.statuses.awaitingDeposit },
    { value: "confirmed", label: m.statuses.confirmed },
    { value: "scheduled", label: m.statuses.scheduled },
  ];

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.firstNameLabel}</strong>
          <input
            name="first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            type="text"
            required
            placeholder={m.firstNamePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-first-name" message={fe?.firstName} />
        </label>
        <label className="order-card">
          <strong>{m.lastNameLabel}</strong>
          <input
            name="last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            type="text"
            required
            placeholder={m.lastNamePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-last-name" message={fe?.lastName} />
        </label>
        <label className="order-card">
          <strong>{m.phoneLabel}</strong>
          <input
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder={m.phonePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-phone" message={fe?.phone} />
        </label>
      </div>

      <label className="order-card">
        <strong>{m.emailLabel}</strong>
        <input
          name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder={m.emailPlaceholder}
          style={{ marginTop: 10, width: "100%" }}
        />
          <FieldError id="err-email" message={fe?.email} />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{dateLabel}</strong>
          <input
            name="event_date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            min={minEventDate}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-event-date" message={fe?.eventDate} />
        </label>
        <label className="order-card">
          <strong>{m.startTimeLabel}</strong>
          <input
            name="start_time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-invalid={timeClash || undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-start-time" message={fe?.startTime} />
        </label>
        <label className="order-card">
          <strong>{m.endTimeLabel}</strong>
          <input
            name="end_time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            aria-invalid={timeClash || undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-end-time" message={fe?.endTime} />
        </label>
      </div>

      {timeClash && (
        <div role="alert" className="badge warning" style={{ padding: "10px 14px" }}>
          {m.sameDayTimeClashWarning}
        </div>
      )}

      <label className="order-card">
        <strong>{m.rentalEndDateLabel}</strong>
        <input
          name="rental_end_date"
          type="date"
          value={rentalEndDate}
          onChange={(e) => setRentalEndDate(e.target.value)}
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
          checked={smsOptIn}
          onChange={(e) => setSmsOptIn(e.target.checked)}
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
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
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
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
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
          <FieldError id="err-product-id" message={fe?.productId} />
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.serviceAreaLabel}</strong>
          <select
            name="service_area_id"
            value={serviceAreaId}
            onChange={(e) => setServiceAreaId(e.target.value)}
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
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-delivery-fee" message={fe?.deliveryFee} />
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {m.deliveryFeeHelp}
          </div>
        </label>
        <label className="order-card">
          <strong>{m.subtotalLabel}</strong>
          <input
            name="subtotal"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-subtotal" message={fe?.subtotal} />
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
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-deposit-amount" message={fe?.depositAmount} />
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
            value={deliveryLine1}
            onChange={(e) => setDeliveryLine1(e.target.value)}
              type="text"
              placeholder={m.streetAddressPlaceholder}
              style={{ width: "100%" }}
            />
          <FieldError id="err-delivery-line1" message={fe?.deliveryLine1} />
          </label>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.aptSuiteLabel}</span>
            <input
              name="delivery_line2"
            value={deliveryLine2}
            onChange={(e) => setDeliveryLine2(e.target.value)}
              type="text"
              placeholder={m.aptSuitePlaceholder}
              style={{ width: "100%" }}
            />
          </label>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.cityLabel}</span>
              <input name="delivery_city"
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)} type="text" placeholder={m.cityPlaceholder} style={{ width: "100%" }} />
          <FieldError id="err-delivery-city" message={fe?.deliveryCity} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.stateLabel}</span>
              <input name="delivery_state"
            value={deliveryStateField}
            onChange={(e) => setDeliveryStateField(e.target.value)} type="text" placeholder={m.statePlaceholder} maxLength={3} style={{ width: "100%" }} />
          <FieldError id="err-delivery-state" message={fe?.deliveryState} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.zipLabel}</span>
              <input name="delivery_zip"
            value={deliveryZip}
            onChange={(e) => setDeliveryZip(e.target.value)} type="text" placeholder={m.zipPlaceholder} maxLength={10} style={{ width: "100%" }} />
          <FieldError id="err-delivery-zip" message={fe?.deliveryZip} />
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
              <select name="delivery_surface_type" value={deliverySurfaceType} onChange={(e) => setDeliverySurfaceType(e.target.value)} style={{ width: "100%" }}>
                <option value="">{m.surfaces.notSpecified}</option>
                <option value="grass">{m.surfaces.grass}</option>
                <option value="concrete">{m.surfaces.concrete}</option>
                <option value="asphalt">{m.surfaces.asphalt}</option>
                <option value="other">{m.surfaces.other}</option>
              </select>
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.gateCodeLabel}</span>
              <input name="delivery_gate_code"
            value={deliveryGateCode}
            onChange={(e) => setDeliveryGateCode(e.target.value)} type="text" placeholder={m.gateCodePlaceholder} style={{ width: "100%" }} />
            </label>
          </div>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.onSiteContactNameLabel}</span>
              <input name="delivery_contact_name"
            value={deliveryContactName}
            onChange={(e) => setDeliveryContactName(e.target.value)} type="text" placeholder={m.onSiteContactNamePlaceholder} style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.onSiteContactPhoneLabel}</span>
              <input name="delivery_contact_phone"
            value={deliveryContactPhone}
            onChange={(e) => setDeliveryContactPhone(e.target.value)} type="tel" placeholder={m.onSiteContactPhonePlaceholder} style={{ width: "100%" }} />
            </label>
          </div>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{m.setupNotesLabel}</span>
            <textarea
              name="delivery_setup_notes"
            value={deliverySetupNotes}
            onChange={(e) => setDeliverySetupNotes(e.target.value)}
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
        <button className="primary-btn" type="submit" disabled={pending || timeClash}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}
