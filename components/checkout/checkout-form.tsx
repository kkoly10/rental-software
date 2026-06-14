"use client";

import { useActionState, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createCheckoutOrder, type CheckoutActionState, type CheckoutFieldErrors } from "@/lib/checkout/actions";
import { WeatherBadge } from "@/components/weather/weather-badge";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";
import { useCart } from "@/lib/cart/cart-context";

const initialState: CheckoutActionState = {
  ok: false,
  message: "",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} className="field-error" role="alert">
      {message}
    </div>
  );
}

export function CheckoutForm({
  productSlug,
  initialDate,
  initialZip,
  minDate,
  maxDate,
  cancellationPolicy,
  selectedMode,
  initialUnits,
  selectedVariantId,
  initialAddons,
  damageWaiver,
  cartJson,
  cartItemNames,
}: {
  productSlug?: string;
  initialDate?: string;
  initialZip?: string;
  minDate?: string;
  maxDate?: string;
  cancellationPolicy?: string;
  /** Phase 3b — multi-item checkout. When present, the form POSTs the
   *  whole cart as a single `cart_json` field (instead of a single
   *  `product_slug`) so createCheckoutOrder routes to the combined
   *  multi-item flow: one order, one deposit, one delivery fee, one
   *  confirmation. The cart is cleared on a successful submit. */
  cartJson?: string;
  /** Display names of the cart's items, shown in the review list. */
  cartItemNames?: string[];
  // Sprint 6.0 — wet/dry choice the customer made on the product
  // detail page. Carried as a hidden form field through to the
  // server action so it lands on order_items.selected_mode + drives
  // the wet upcharge on the line total.
  selectedMode?: "dry" | "wet";
  // Phase 2e.13b — units count for per-unit products, taken from the
  // PDP selector and forwarded as a hidden field to the submit
  // action. Validated + clamped server-side.
  initialUnits?: string;
  // Phase 2e.12 — variant id picked on the PDP. Carried as a hidden
  // form field; the server action validates it belongs to the
  // product, applies price_delta_cents, and writes it to
  // order_items.selected_variant_id.
  selectedVariantId?: string;
  // Phase 2e.10 — composition.add-ons selections, encoded as
  // "id:qty,id:qty". Forwarded verbatim to the server action which
  // parses + validates each entry against the parent product's
  // configured add-ons before inserting child order_items rows.
  initialAddons?: string;
  /** PR-2c — when the product offers a damage waiver, the PDP passes
   *  the rate so the checkout form can render an opt-in checkbox.
   *  Null when the product doesn't offer one. */
  damageWaiver?: {
    rateBps: number;
    /** Live cents preview of the surcharge based on the subtotal the
     *  pricing engine returned for this checkout — purely cosmetic;
     *  the server recomputes from the product row at submit time. */
    previewAmountCents: number;
  } | null;
}) {
  const { messages: m } = useI18n();
  const { clear: clearCart } = useCart();
  const isMultiItem = !!cartJson;
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );

  // Phase 3b — clear the cart once a multi-item checkout succeeds (the
  // order is committed; whether it then routes to Stripe or shows the
  // submitted screen, the cart should not survive). Mirrors how a normal
  // checkout ends. Runs once per successful state.
  useEffect(() => {
    if (isMultiItem && state.ok && state.orderNumber) {
      clearCart();
    }
  }, [isMultiItem, state.ok, state.orderNumber, clearCart]);
  // Sticky values for the form. Inputs are controlled (value + onChange)
  // because React 19's <form action={...}> reset semantics for
  // useActionState aren't reliable across browsers + Next.js's server-
  // action path — uncontrolled defaultValue alone left fields blank
  // after a failed submit in production. Controlled state guarantees
  // each value sticks even when the action returns an error.
  //
  // First render seeds from state.submittedValues (if the previous
  // submit echoed back) then from the URL params (initialDate /
  // initialZip from the product detail page). On subsequent action
  // returns, a useEffect re-syncs the locals to whatever the server
  // just echoed, so a typed value never disappears.
  const sv = state.submittedValues;
  const [firstName, setFirstName] = useState(sv?.firstName ?? "");
  const [lastName, setLastName] = useState(sv?.lastName ?? "");
  const [phone, setPhone] = useState(sv?.phone ?? "");
  const [email, setEmail] = useState(sv?.email ?? "");
  const [selectedDate, setSelectedDate] = useState(sv?.eventDate ?? initialDate ?? "");
  const [startTime, setStartTime] = useState(sv?.startTime ?? "");
  const [endTime, setEndTime] = useState(sv?.endTime ?? "");
  const [line1, setLine1] = useState(sv?.line1 ?? "");
  const [line2, setLine2] = useState(sv?.line2 ?? "");
  const [city, setCity] = useState(sv?.city ?? "");
  const [stateField, setStateField] = useState(sv?.state ?? "");
  const [enteredZip, setEnteredZip] = useState(sv?.postalCode ?? initialZip ?? "");

  // Checkboxes also need to be controlled — same reset hazard as the
  // text inputs. The terms_accepted box is the one that actually
  // matters: without controlled state the customer would unwittingly
  // submit again with terms unchecked and get a second error, which
  // is both annoying and lets them blow through the agreement gate
  // unintentionally. sms_opt_in is also controlled so the customer's
  // marketing-consent choice doesn't silently flip back to false after
  // a failed submit.
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Re-hydrate the local state whenever the server action returns a
  // fresh submittedValues payload — covers the case where React's
  // form reset wiped the DOM inputs before our state had a chance to
  // catch up. The dep is on the identity of submittedValues so an
  // unchanged state (e.g. re-render unrelated to a submit) is a no-op.
  useEffect(() => {
    if (!state.submittedValues) return;
    const v = state.submittedValues;
    if (v.firstName !== undefined) setFirstName(v.firstName);
    if (v.lastName !== undefined) setLastName(v.lastName);
    if (v.phone !== undefined) setPhone(v.phone);
    if (v.email !== undefined) setEmail(v.email);
    if (v.eventDate !== undefined) setSelectedDate(v.eventDate);
    if (v.startTime !== undefined) setStartTime(v.startTime);
    if (v.endTime !== undefined) setEndTime(v.endTime);
    if (v.line1 !== undefined) setLine1(v.line1);
    if (v.line2 !== undefined) setLine2(v.line2);
    if (v.city !== undefined) setCity(v.city);
    if (v.state !== undefined) setStateField(v.state);
    if (v.postalCode !== undefined) setEnteredZip(v.postalCode);
  }, [state.submittedValues]);

  // Decision 4.10 — refresh the server-rendered summary card when the
  // customer changes the ZIP. We push a new ?zip= into the URL so
  // getCheckoutPricing runs again with the new service-area context.
  // Debounced so every keystroke doesn't trigger a navigation; only
  // a full 5-digit code does.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const normalized = enteredZip.replace(/\D/g, "");
    if (normalized.length !== 5) return;
    const current = searchParams?.get("zip") ?? "";
    if (current === normalized) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.set("zip", normalized);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [enteredZip, pathname, router, searchParams]);

  const errors: CheckoutFieldErrors = state.fieldErrors ?? {};

  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  // Idempotency key — generated once when the form mounts and persisted
  // across re-renders / retries. If the browser resubmits because of a
  // network hiccup, the server sees the same key, recognises the second
  // POST as a replay, and returns the already-created order's number.
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `cko_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  });

  // Only redirect after customer explicitly confirms on the review screen
  useEffect(() => {
    if (reviewConfirmed && state.stripeUrl?.startsWith("https://checkout.stripe.com/")) {
      window.location.href = state.stripeUrl;
    }
  }, [reviewConfirmed, state.stripeUrl]);

  // Review screen: order created, show summary before sending to Stripe
  if (state.ok && state.stripeUrl && state.summary && !reviewConfirmed) {
    const s = state.summary;
    return (
      <div style={{ marginTop: 16 }} className="list">
        <div className="order-card" style={{ borderLeft: "4px solid var(--accent)", padding: 20 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>{m.checkout.review.kicker}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {s.items && s.items.length > 0 ? (
              <div style={{ display: "grid", gap: 6 }}>
                <span className="muted">{m.checkout.review.items}</span>
                {s.items.map((it, i) => (
                  <div className="order-row" key={`${it.name}-${i}`}>
                    <span>
                      {it.name}
                      {it.quantity > 1 ? ` × ${it.quantity}` : ""}
                    </span>
                    <span>{it.lineTotal}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="order-row">
                <span className="muted">{m.checkout.review.item}</span>
                <strong>{s.productName}</strong>
              </div>
            )}
            {s.eventDate && (
              <div className="order-row">
                <span className="muted">{m.checkout.review.eventDate}</span>
                <span>{s.eventDate}</span>
              </div>
            )}
            {s.address && (
              <div className="order-row">
                <span className="muted">{m.checkout.review.deliveryTo}</span>
                <span style={{ textAlign: "right", maxWidth: "55%" }}>{s.address}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
              <div className="order-row">
                <span className="muted">{m.checkout.review.subtotal}</span>
                <span>{s.subtotal}</span>
              </div>
              {s.wetUpcharge && (
                // Sprint 6.0 — surface the wet upcharge as its own
                // line so the customer can reconcile the total against
                // the per-mode price they saw on the storefront. Only
                // renders when the customer actually picked wet AND
                // the operator set a non-zero upcharge.
                <div className="order-row">
                  <span className="muted">{m.checkout.review.wetUpcharge}</span>
                  <span>+{s.wetUpcharge}</span>
                </div>
              )}
              <div className="order-row">
                <span className="muted">{m.checkout.review.deliveryFee}</span>
                <span>{s.deliveryFee}</span>
              </div>
              {s.tax && (
                <div className="order-row">
                  <span className="muted">{s.taxLabel ?? m.checkoutSummary.tax}</span>
                  <span>{s.tax}</span>
                </div>
              )}
              <div className="order-row" style={{ fontWeight: 600 }}>
                <span>{m.checkout.review.total}</span>
                <span>{s.total}</span>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
              <div className="order-row">
                <span className="muted">{m.checkout.review.depositDueNow}</span>
                <strong style={{ color: "var(--primary)" }}>{s.depositDue}</strong>
              </div>
              <div className="order-row">
                <span className="muted">{m.checkout.review.balanceDueLater}</span>
                <span>{s.balanceDue}</span>
              </div>
              {s.depositClampNote && (
                <div
                  className="muted"
                  style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}
                >
                  {s.depositClampNote}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="primary-btn storefront-search-btn"
            type="button"
            disabled={reviewConfirmed}
            onClick={() => setReviewConfirmed(true)}
          >
            {formatMessage(m.checkout.review.confirm, { amount: s.depositDue })}
          </button>
          <Link href="/inventory" className="secondary-btn">
            {m.checkout.review.cancel}
          </Link>
        </div>
      </div>
    );
  }

  if (state.ok && state.message && !state.stripeUrl) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          className="order-card"
          style={{ borderLeft: "4px solid var(--accent)", padding: 20 }}
        >
          <strong>{m.checkout.submitted.title}</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {state.message}
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/order-confirmation?order=${state.orderNumber ?? ""}&status=unpaid`} className="primary-btn">
            {m.checkout.submitted.viewDetails}
          </Link>
          <Link href="/inventory" className="secondary-btn">
            {m.checkout.submitted.browseMore}
          </Link>
        </div>
      </div>
    );
  }

  // Redirecting to Stripe after customer confirmed
  if (state.ok && state.stripeUrl && reviewConfirmed) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          className="order-card"
          style={{ borderLeft: "4px solid var(--accent)", padding: 20 }}
        >
          <strong>{m.checkout.redirecting.title}</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {m.checkout.redirecting.body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {isMultiItem ? (
        // Phase 3b — the whole cart is POSTed as one field; its presence
        // routes the action to the combined multi-item flow. The
        // single-item hidden fields below are intentionally NOT emitted.
        <input type="hidden" name="cart_json" value={cartJson} />
      ) : null}
      {!isMultiItem && productSlug ? (
        <input type="hidden" name="product_slug" value={productSlug} />
      ) : null}
      {!isMultiItem && selectedMode ? (
        <input type="hidden" name="selected_mode" value={selectedMode} />
      ) : null}
      {!isMultiItem && initialUnits && /^\d+$/.test(initialUnits) ? (
        <input type="hidden" name="units" value={initialUnits} />
      ) : null}
      {!isMultiItem && selectedVariantId && /^[0-9a-f-]{36}$/i.test(selectedVariantId) ? (
        <input type="hidden" name="selected_variant_id" value={selectedVariantId} />
      ) : null}
      {!isMultiItem && initialAddons && /^[0-9a-f-]{36}:\d+(,[0-9a-f-]{36}:\d+)*$/i.test(initialAddons) ? (
        <input type="hidden" name="addons" value={initialAddons} />
      ) : null}

      {isMultiItem && cartItemNames && cartItemNames.length > 0 ? (
        <div className="order-card" style={{ padding: 16 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>
            {formatMessage(m.checkout.multiItem.itemsHeading, {
              count: cartItemNames.length,
            })}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {cartItemNames.map((name, i) => (
              <li key={`${name}-${i}`} style={{ fontSize: 14 }}>
                {name}
              </li>
            ))}
          </ul>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {m.checkout.multiItem.pricingNote}
          </div>
        </div>
      ) : null}

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.checkout.form.firstName}</strong>
          <input
            name="first_name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            placeholder={m.checkout.form.firstName}
            required
            aria-invalid={!!errors.firstName || undefined}
            aria-describedby={errors.firstName ? "err-first-name" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-first-name" message={errors.firstName} />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.lastName}</strong>
          <input
            name="last_name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            placeholder={m.checkout.form.lastName}
            required
            aria-invalid={!!errors.lastName || undefined}
            aria-describedby={errors.lastName ? "err-last-name" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-last-name" message={errors.lastName} />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.phone}</strong>
          <input
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="(540) 555-0100"
            aria-invalid={!!errors.phone || undefined}
            aria-describedby={errors.phone ? "err-phone" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-phone" message={errors.phone} />
        </label>
      </div>

      <label
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 0 2px" }}
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
          {m.checkout.form.smsOptIn}
        </span>
      </label>

      {damageWaiver && damageWaiver.rateBps > 0 && (
        <label
          className="order-card"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            padding: "12px 14px",
            marginTop: 8,
          }}
        >
          <input
            type="checkbox"
            name="damage_waiver"
            value="on"
            checked={waiverAccepted}
            onChange={(e) => setWaiverAccepted(e.target.checked)}
            style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>{m.checkout.form.damageWaiverTitle}</strong>
            <br />
            <span className="muted">
              {m.checkout.form.damageWaiverBody
                .replace("{rate}", (damageWaiver.rateBps / 100).toFixed(2))
                .replace(
                  "{amount}",
                  (damageWaiver.previewAmountCents / 100).toFixed(2)
                )}
            </span>
          </span>
        </label>
      )}

      <label className="order-card">
        <strong>{m.checkout.form.email}</strong>
        <input
          name="email"
          type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={m.checkout.form.emailPlaceholder}
          required
          aria-invalid={!!errors.email || undefined}
          aria-describedby={errors.email ? "err-email" : undefined}
          style={{ marginTop: 10, width: "100%" }}
        />
        <FieldError id="err-email" message={errors.email} />
      </label>

      <label className="order-card">
        <strong>{m.checkout.form.eventDate}</strong>
        <input
          name="event_date"
          type="date"
          required
          value={selectedDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          aria-invalid={!!errors.eventDate || undefined}
          aria-describedby={errors.eventDate ? "err-event-date" : undefined}
          style={{ marginTop: 10, width: "100%" }}
        />
        <FieldError id="err-event-date" message={errors.eventDate} />
        {selectedDate && enteredZip.length === 5 && (
          <div style={{ marginTop: 8 }}>
            <WeatherBadge eventDate={selectedDate} zipCode={enteredZip} />
          </div>
        )}
      </label>

      <div className="grid grid-2">
        <label className="order-card">
          <strong>{m.checkout.form.startTime}</strong>
          <input
            name="start_time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.endTime}</strong>
          <input
            name="end_time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>{m.checkout.form.deliveryAddress}</strong>
        <input
          name="line1"
          type="text"
            defaultValue={sv?.line1 ?? ""}
          autoComplete="street-address"
          placeholder={m.checkout.form.streetAddress}
          required
          aria-invalid={!!errors.line1 || undefined}
          aria-describedby={errors.line1 ? "err-line1" : undefined}
          style={{ marginTop: 10, width: "100%" }}
        />
        <FieldError id="err-line1" message={errors.line1} />
        <input
          name="line2"
          type="text"
            defaultValue={sv?.line2 ?? ""}
          autoComplete="address-line2"
          placeholder={m.checkout.form.line2Placeholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.checkout.form.city}</strong>
          <input
            name="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            placeholder={m.checkout.form.cityPlaceholder}
            required
            aria-invalid={!!errors.city || undefined}
            aria-describedby={errors.city ? "err-city" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-city" message={errors.city} />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.state}</strong>
          <input
            name="state"
            type="text"
            value={stateField}
            onChange={(e) => setStateField(e.target.value)}
            autoComplete="address-level1"
            placeholder={m.checkout.form.statePlaceholder}
            required
            aria-invalid={!!errors.state || undefined}
            aria-describedby={errors.state ? "err-state" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-state" message={errors.state} />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.zip}</strong>
          <input
            name="postal_code"
            type="text"
            autoComplete="postal-code"
            placeholder={m.checkout.form.zipPlaceholder}
            required
            value={enteredZip}
            onChange={(e) => setEnteredZip(e.target.value)}
            aria-invalid={!!errors.postalCode || undefined}
            aria-describedby={errors.postalCode ? "err-postal-code" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-postal-code" message={errors.postalCode} />
        </label>
      </div>

      <label
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 0" }}
      >
        <input
          name="terms_accepted"
          type="checkbox"
          required
          value="true"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
        />
        <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-soft)" }}>
          {cancellationPolicy
            ? formatMessage(m.checkout.form.termsAgreePolicy, { policy: cancellationPolicy })
            : m.checkout.form.termsAgree}
        </span>
      </label>

      {state.message && !state.ok && !state.fieldErrors ? (
        <div className="badge warning" role="alert" style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="primary-btn storefront-search-btn" type="submit" disabled={pending}>
          {pending ? m.checkout.form.submitting : m.checkout.form.submit}
        </button>
      </div>
    </form>
  );
}
