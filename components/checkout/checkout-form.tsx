"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import { createCheckoutOrder, type CheckoutActionState, type CheckoutFieldErrors } from "@/lib/checkout/actions";
import { WeatherBadge } from "@/components/weather/weather-badge";

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
}: {
  productSlug?: string;
  initialDate?: string;
  initialZip?: string;
  minDate?: string;
  maxDate?: string;
  cancellationPolicy?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [enteredZip, setEnteredZip] = useState(initialZip ?? "");

  const errors: CheckoutFieldErrors = state.fieldErrors ?? {};

  const [reviewConfirmed, setReviewConfirmed] = useState(false);

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
          <div className="kicker" style={{ marginBottom: 8 }}>Review your order</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="order-row">
              <span className="muted">Item</span>
              <strong>{s.productName}</strong>
            </div>
            {s.eventDate && (
              <div className="order-row">
                <span className="muted">Event date</span>
                <span>{s.eventDate}</span>
              </div>
            )}
            {s.address && (
              <div className="order-row">
                <span className="muted">Delivery to</span>
                <span style={{ textAlign: "right", maxWidth: "55%" }}>{s.address}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
              <div className="order-row">
                <span className="muted">Subtotal</span>
                <span>{s.subtotal}</span>
              </div>
              <div className="order-row">
                <span className="muted">Delivery fee</span>
                <span>{s.deliveryFee}</span>
              </div>
              <div className="order-row" style={{ fontWeight: 600 }}>
                <span>Total</span>
                <span>{s.total}</span>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
              <div className="order-row">
                <span className="muted">Deposit due now</span>
                <strong style={{ color: "var(--primary)" }}>{s.depositDue}</strong>
              </div>
              <div className="order-row">
                <span className="muted">Balance due later</span>
                <span>{s.balanceDue}</span>
              </div>
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
            Confirm &amp; Pay Deposit ({s.depositDue})
          </button>
          <Link href="/inventory" className="secondary-btn">
            Cancel
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
          <strong>Booking submitted!</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {state.message}
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/order-confirmation?order=${state.orderNumber ?? ""}&status=unpaid`} className="primary-btn">
            View order details
          </Link>
          <Link href="/inventory" className="secondary-btn">
            Browse more rentals
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
          <strong>Redirecting to secure payment...</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            You&apos;ll be taken to Stripe to complete your deposit payment.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {productSlug ? (
        <input type="hidden" name="product_slug" value={productSlug} />
      ) : null}

      <div className="grid grid-3">
        <label className="order-card">
          <strong>First name</strong>
          <input
            name="first_name"
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            required
            aria-invalid={!!errors.firstName || undefined}
            aria-describedby={errors.firstName ? "err-first-name" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-first-name" message={errors.firstName} />
        </label>

        <label className="order-card">
          <strong>Last name</strong>
          <input
            name="last_name"
            type="text"
            autoComplete="family-name"
            placeholder="Last name"
            required
            aria-invalid={!!errors.lastName || undefined}
            aria-describedby={errors.lastName ? "err-last-name" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-last-name" message={errors.lastName} />
        </label>

        <label className="order-card">
          <strong>Phone</strong>
          <input
            name="phone"
            type="tel"
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
          style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-soft)" }}>
          Text me order updates (confirmation, delivery reminders, status). Msg &amp; data rates may apply. Reply STOP to opt out.
        </span>
      </label>

      <label className="order-card">
        <strong>Email</strong>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={!!errors.email || undefined}
          aria-describedby={errors.email ? "err-email" : undefined}
          style={{ marginTop: 10, width: "100%" }}
        />
        <FieldError id="err-email" message={errors.email} />
      </label>

      <label className="order-card">
        <strong>Event date</strong>
        <input
          name="event_date"
          type="date"
          required
          defaultValue={initialDate}
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
          <strong>Start time</strong>
          <input
            name="start_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>End time</strong>
          <input
            name="end_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>Delivery address</strong>
        <input
          name="line1"
          type="text"
          autoComplete="street-address"
          placeholder="Street address"
          required
          aria-invalid={!!errors.line1 || undefined}
          aria-describedby={errors.line1 ? "err-line1" : undefined}
          style={{ marginTop: 10, width: "100%" }}
        />
        <FieldError id="err-line1" message={errors.line1} />
        <input
          name="line2"
          type="text"
          autoComplete="address-line2"
          placeholder="Apt / Suite / Unit (optional)"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>City</strong>
          <input
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="City"
            required
            aria-invalid={!!errors.city || undefined}
            aria-describedby={errors.city ? "err-city" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-city" message={errors.city} />
        </label>

        <label className="order-card">
          <strong>State</strong>
          <input
            name="state"
            type="text"
            autoComplete="address-level1"
            placeholder="VA"
            required
            aria-invalid={!!errors.state || undefined}
            aria-describedby={errors.state ? "err-state" : undefined}
            style={{ marginTop: 10, width: "100%" }}
          />
          <FieldError id="err-state" message={errors.state} />
        </label>

        <label className="order-card">
          <strong>ZIP code</strong>
          <input
            name="postal_code"
            type="text"
            autoComplete="postal-code"
            placeholder="22554"
            required
            defaultValue={initialZip}
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
          style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
        />
        <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-soft)" }}>
          {cancellationPolicy
            ? `I agree to the rental terms and cancellation policy: "${cancellationPolicy}"`
            : "I understand that this booking is subject to the rental operator's terms and policies"}
        </span>
      </label>

      {state.message && !state.ok && !state.fieldErrors ? (
        <div className="badge warning" role="alert" style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="primary-btn storefront-search-btn" type="submit" disabled={pending}>
          {pending ? "Creating Order..." : "Place Booking"}
        </button>
      </div>
    </form>
  );
}
