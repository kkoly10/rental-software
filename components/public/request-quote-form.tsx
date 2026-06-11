"use client";

import { useActionState } from "react";
import { submitQuoteRequest, type QuoteRequestState } from "@/lib/checkout/quote-request-actions";

const INITIAL: QuoteRequestState = { ok: false, message: "" };

/**
 * PR-3d — customer-facing "Request a quote" form on the PDP.
 *
 * Gated by theme_settings.cta_secondary='request_quote' (the operator
 * turns it on per-storefront). For tent / dance-floor / multi-
 * component products the operator needs to confirm scope before
 * pricing — direct checkout doesn't fit. This form creates an
 * inquiry order via lib/checkout/quote-request-actions.ts and
 * notifies the operator; the existing dashboard quote-send flow
 * picks it up unchanged.
 *
 * Shape mirrors the existing CheckoutForm styling so it doesn't
 * feel like a separate surface to the customer.
 */
export function RequestQuoteForm({
  productSlug,
  initialDate,
  initialZip,
}: {
  productSlug?: string;
  initialDate?: string;
  initialZip?: string;
}) {
  const [state, formAction, pending] = useActionState(submitQuoteRequest, INITIAL);

  if (state.ok) {
    return (
      <div
        className="order-card"
        role="status"
        style={{ padding: 16, borderLeft: "4px solid var(--success, #16a34a)" }}
      >
        <strong>{state.message}</strong>
        {state.orderNumber && (
          <p className="muted" style={{ marginTop: 6 }}>
            Your reference is order #{state.orderNumber}. We've emailed the operator and you'll
            hear from them shortly.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      {productSlug && <input type="hidden" name="product_slug" value={productSlug} />}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <strong>First name</strong>
          <input name="first_name" required style={{ width: "100%" }} />
        </label>
        <label>
          <strong>Last name</strong>
          <input name="last_name" required style={{ width: "100%" }} />
        </label>
      </div>
      <label>
        <strong>Email</strong>
        <input type="email" name="email" required style={{ width: "100%" }} />
      </label>
      <label>
        <strong>Phone</strong>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          style={{ width: "100%" }}
        />
      </label>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <strong>Event date</strong>
          <input
            type="date"
            name="event_date"
            defaultValue={initialDate ?? ""}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <strong>Delivery ZIP</strong>
          <input
            name="zip"
            inputMode="numeric"
            defaultValue={initialZip ?? ""}
            style={{ width: "100%" }}
          />
        </label>
      </div>
      <label>
        <strong>What are you planning?</strong>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Guest count, setup location, anything else we should know"
          style={{ width: "100%", resize: "vertical" }}
        />
      </label>
      <button
        type="submit"
        className="primary-btn"
        disabled={pending}
        style={{ marginTop: 4 }}
      >
        {pending ? "Sending…" : "Request quote"}
      </button>
      {state.message && !state.ok && (
        <span className="badge warning" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
