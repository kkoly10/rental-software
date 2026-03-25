"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCheckoutOrder } from "@/lib/checkout/actions";

const initialState = {
  ok: false,
  message: "",
};

export function CheckoutForm({ productSlug }: { productSlug?: string }) {
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );

  if (state.ok && state.message) {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="order-card" style={{ borderLeft: "4px solid var(--accent)", padding: 20 }}>
          <strong>Booking submitted!</strong>
          <div className="muted" style={{ marginTop: 8 }}>{state.message}</div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <Link href="/inventory" className="primary-btn">
            Browse more rentals
          </Link>
          <Link href="/" className="secondary-btn">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {productSlug && <input type="hidden" name="product_slug" value={productSlug} />}
      <div className="grid grid-3">
        <label className="order-card">
          <strong>First name</strong>
          <input
            name="first_name"
            type="text"
            placeholder="First name"
            required
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Last name</strong>
          <input
            name="last_name"
            type="text"
            placeholder="Last name"
            required
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Phone</strong>
          <input
            name="phone"
            type="tel"
            placeholder="(540) 555-0100"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>Email</strong>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Event date</strong>
        <input
          name="event_date"
          type="date"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Delivery address</strong>
        <input
          name="line1"
          type="text"
          placeholder="Street address"
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>City</strong>
          <input name="city" type="text" placeholder="City" required style={{ marginTop: 10, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>State</strong>
          <input name="state" type="text" placeholder="VA" required style={{ marginTop: 10, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>ZIP code</strong>
          <input name="postal_code" type="text" placeholder="22554" required style={{ marginTop: 10, width: "100%" }} />
        </label>
      </div>

      {state.message && !state.ok ? (
        <div className="badge warning" style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Creating Order..." : "Place Booking"}
        </button>
      </div>
    </form>
  );
}
