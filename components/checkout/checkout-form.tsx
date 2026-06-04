"use client";

import { useActionState, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createCheckoutOrder, type CheckoutActionState, type CheckoutFieldErrors } from "@/lib/checkout/actions";
import { WeatherBadge } from "@/components/weather/weather-badge";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

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
}: {
  productSlug?: string;
  initialDate?: string;
  initialZip?: string;
  minDate?: string;
  maxDate?: string;
  cancellationPolicy?: string;
  // Sprint 6.0 — wet/dry choice the customer made on the product
  // detail page. Carried as a hidden form field through to the
  // server action so it lands on order_items.selected_mode + drives
  // the wet upcharge on the line total.
  selectedMode?: "dry" | "wet";
}) {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(
    createCheckoutOrder,
    initialState
  );
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [enteredZip, setEnteredZip] = useState(initialZip ?? "");

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
            <div className="order-row">
              <span className="muted">{m.checkout.review.item}</span>
              <strong>{s.productName}</strong>
            </div>
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
      {productSlug ? (
        <input type="hidden" name="product_slug" value={productSlug} />
      ) : null}
      {selectedMode ? (
        <input type="hidden" name="selected_mode" value={selectedMode} />
      ) : null}

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.checkout.form.firstName}</strong>
          <input
            name="first_name"
            type="text"
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
          {m.checkout.form.smsOptIn}
        </span>
      </label>

      <label className="order-card">
        <strong>{m.checkout.form.email}</strong>
        <input
          name="email"
          type="email"
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
          <strong>{m.checkout.form.startTime}</strong>
          <input
            name="start_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{m.checkout.form.endTime}</strong>
          <input
            name="end_time"
            type="time"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      <label className="order-card">
        <strong>{m.checkout.form.deliveryAddress}</strong>
        <input
          name="line1"
          type="text"
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
