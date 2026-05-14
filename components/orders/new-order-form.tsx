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
        <strong>Rental end date</strong>
        <input
          name="rental_end_date"
          type="date"
          style={{ marginTop: 10, width: "100%" }}
        />
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Optional — leave blank for single-day rentals. Set for multi-day events.
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
          <strong style={{ color: "var(--text)" }}>Customer consents to SMS updates</strong>
          <br />
          Check only if the customer has explicitly agreed to receive text notifications
          (order confirmation, delivery reminders, status updates).
        </span>
      </label>

      <div className="grid grid-3">
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

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>Delivery address</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Street address</span>
            <input
              name="delivery_line1"
              type="text"
              placeholder="123 Main St"
              style={{ width: "100%" }}
            />
          </label>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Apt / Suite / Unit (optional)</span>
            <input
              name="delivery_line2"
              type="text"
              placeholder="Apt 4B"
              style={{ width: "100%" }}
            />
          </label>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>City</span>
              <input name="delivery_city" type="text" placeholder="Springfield" style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>State</span>
              <input name="delivery_state" type="text" placeholder="VA" maxLength={3} style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>ZIP</span>
              <input name="delivery_zip" type="text" placeholder="22150" maxLength={10} style={{ width: "100%" }} />
            </label>
          </div>
        </div>
      </div>

      <div className="order-card" style={{ paddingBottom: 4 }}>
        <strong style={{ display: "block", marginBottom: 14 }}>Delivery details</strong>
        <div style={{ display: "grid", gap: 10 }}>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Surface type</span>
              <select name="delivery_surface_type" defaultValue="" style={{ width: "100%" }}>
                <option value="">Not specified</option>
                <option value="grass">Grass</option>
                <option value="concrete">Concrete</option>
                <option value="asphalt">Asphalt</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Gate / access code</span>
              <input name="delivery_gate_code" type="text" placeholder="e.g. #1234" style={{ width: "100%" }} />
            </label>
          </div>
          <div className="grid grid-3">
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>On-site contact name</span>
              <input name="delivery_contact_name" type="text" placeholder="Jane Smith" style={{ width: "100%" }} />
            </label>
            <label className="field-stack">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>On-site contact phone</span>
              <input name="delivery_contact_phone" type="tel" placeholder="(540) 555-0100" style={{ width: "100%" }} />
            </label>
          </div>
          <label className="field-stack">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Setup notes</span>
            <textarea
              name="delivery_setup_notes"
              placeholder="Backyard access, slope, low-hanging wires, HOA rules, etc."
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
        <strong>Internal notes</strong>
        <textarea
          name="notes"
          placeholder="Internal notes for your team."
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