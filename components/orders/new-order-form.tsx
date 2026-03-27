"use client";

import { useActionState } from "react";
import { createOrder } from "@/lib/orders/actions";
import type {
  OrderFormProductOption,
  OrderFormServiceAreaOption,
} from "@/lib/data/order-form-options";

const initialState = { ok: false, message: "" };

const ORDER_STATUSES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "awaiting_deposit", label: "Awaiting Deposit" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
];

export function NewOrderForm({
  products,
  serviceAreas,
}: {
  products: OrderFormProductOption[];
  serviceAreas: OrderFormServiceAreaOption[];
}) {
  const [state, formAction, pending] = useActionState(createOrder, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <div className="grid grid-3">
        <label className="order-card">
          <strong>First name</strong>
          <input
            name="first_name"
            type="text"
            required
            placeholder="First name"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>Last name</strong>
          <input
            name="last_name"
            type="text"
            required
            placeholder="Last name"
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
          placeholder="customer@example.com"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Event date</strong>
          <input
            name="event_date"
            type="date"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
        <label className="order-card">
          <strong>Order status</strong>
          <select
            name="order_status"
            defaultValue="inquiry"
            style={{ marginTop: 10, width: "100%" }}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>Product</strong>
          <select
            name="product_id"
            defaultValue=""
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="">No product selected</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · ${product.basePrice}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Service area</strong>
          <select
            name="service_area_id"
            defaultValue=""
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="">Manual / no service area selected</option>
            {serviceAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label} · ${area.deliveryFee} fee · ${area.minimumOrderAmount} min
              </option>
            ))}
          </select>
        </label>
        <label className="order-card">
          <strong>Delivery fee</strong>
          <input
            name="delivery_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Auto-overridden when a service area is selected.
          </div>
        </label>
        <label className="order-card">
          <strong>Subtotal ($)</strong>
          <input
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            style={{ marginTop: 10, width: "100%" }}
          />
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            If left at 0 and a product is selected, the product base price is used.
          </div>
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Deposit amount ($)</strong>
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
          <strong>Total</strong>
          <div className="muted" style={{ marginTop: 10 }}>
            Calculated on save from subtotal + delivery fee.
          </div>
        </div>
      </div>

      <label className="order-card">
        <strong>Notes</strong>
        <textarea
          name="notes"
          placeholder="Special instructions, setup details, etc."
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
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px" }}
        >
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Order"}
        </button>
      </div>
    </form>
  );
}