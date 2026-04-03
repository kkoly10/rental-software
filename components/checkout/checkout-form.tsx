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
}: {
  productSlug?: string;
  initialDate?: string;
  initialZip?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [enteredZip, setEnteredZip] = useState(initialZip ?? "");

  const errors: CheckoutFieldErrors = state.fieldErrors ?? {};

  // Redirect to Stripe if a URL was returned
  useEffect(() => {
    if (state.ok && state.stripeUrl) {
      window.location.href = state.stripeUrl;
    }
  }, [state.ok, state.stripeUrl]);

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

  // Show a loading state while redirecting to Stripe
  if (state.ok && state.stripeUrl) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          className="order-card"
          style={{ borderLeft: "4px solid var(--accent)", padding: 20 }}
        >
          <strong>Order created — redirecting to payment...</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {state.message}
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
          defaultValue={initialDate}
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
