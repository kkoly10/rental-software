"use client";

import { useActionState } from "react";
import { createCheckoutOrder } from "@/lib/checkout/actions";

const initialState = {
  ok: false,
  message: "",
};

export function CheckoutForm() {
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>First name</strong>
        <input
          name="first_name"
          type="text"
          placeholder="First name"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Last name</strong>
        <input
          name="last_name"
          type="text"
          placeholder="Last name"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Email</strong>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
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

      <label className="order-card">
        <strong>Delivery address</strong>
        <input
          name="line1"
          type="text"
          placeholder="Street address"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>City</strong>
          <input
            name="city"
            type="text"
            placeholder="City"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>State</strong>
          <input
            name="state"
            type="text"
            placeholder="VA"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>ZIP code</strong>
          <input
            name="postal_code"
            type="text"
            placeholder="22554"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Creating Order..." : "Place Booking"}
        </button>
      </div>
    </form>
  );
}