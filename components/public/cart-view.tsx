"use client";

import Link from "next/link";
import { useCart, cartItemCheckoutHref } from "@/lib/cart/cart-context";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Storefront cart page body (Phase 1). Lists the cart's items, lets the
 * customer set the shared event date + delivery ZIP, remove items, and check
 * out. Until Phase 3 (combined multi-item submit) each item checks out through
 * today's single-item flow — stated plainly so the interim isn't confusing.
 */
export function CartView() {
  const { cart, hydrated, removeItem, clear, setEvent } = useCart();
  const { messages: m } = useI18n();
  const c = m.cart;

  // Avoid an SSR/first-paint mismatch: the cart is read from localStorage on
  // mount, so render a quiet placeholder until hydrated.
  if (!hydrated) {
    return (
      <section className="st-container st-section">
        <p className="st-cart-empty-note">{c.loading}</p>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="st-container st-section">
        <div className="st-empty-state">
          <span className="st-eyebrow">{c.title}</span>
          <h1 className="st-empty-state-title">{c.empty}</h1>
          <p style={{ marginTop: 16 }}>
            <Link href="/inventory" className="st-text-link">
              {c.browse} →
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="st-container st-section">
      <span className="st-eyebrow">{c.title}</span>
      <h1 className="st-section-title">{c.heading}</h1>

      <div className="st-cart-event">
        <label className="st-cart-field">
          <span className="st-eyebrow">{m.storefront.hero.eventDate}</span>
          <input
            type="date"
            value={cart.eventDate ?? ""}
            onChange={(e) => setEvent({ eventDate: e.target.value })}
            className="st-pdp-input"
          />
        </label>
        <label className="st-cart-field">
          <span className="st-eyebrow">{m.storefront.hero.deliveryZip}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            pattern="[0-9-]*"
            placeholder={m.storefront.hero.zipPlaceholder}
            value={cart.zip ?? ""}
            onChange={(e) => setEvent({ zip: e.target.value })}
            className="st-pdp-input"
          />
        </label>
      </div>

      {(() => {
        const canCheckout = !!(cart.eventDate && cart.zip);
        return (
          <div className="st-cart-checkout-all" style={{ margin: "16px 0" }}>
            {canCheckout ? (
              <Link href="/cart/checkout" className="primary-btn st-cart-checkout-primary">
                {c.proceedToCheckout}
              </Link>
            ) : (
              <>
                <button type="button" className="primary-btn st-cart-checkout-primary" disabled>
                  {c.proceedToCheckout}
                </button>
                <p className="st-note" role="note" style={{ marginTop: 8 }}>
                  {c.needEventInfo}
                </p>
              </>
            )}
          </div>
        );
      })()}

      <p className="st-note" role="note">
        {c.interimNote}
      </p>

      <ul className="st-cart-list">
        {cart.items.map((item, index) => {
          const meta: string[] = [];
          if (item.variantLabel) meta.push(item.variantLabel);
          if (item.mode) meta.push(item.mode === "wet" ? c.modeWet : c.modeDry);
          if (item.units && item.units > 0) meta.push(`× ${item.units}`);
          if (item.addons && item.addons.length > 0) {
            meta.push(
              item.addons.length === 1
                ? c.oneAddon
                : c.addonCount.replace("{count}", String(item.addons.length)),
            );
          }
          return (
            <li key={`${item.slug}-${item.addedAt}-${index}`} className="st-cart-item">
              <div
                className="st-cart-item-img"
                style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : undefined}
                role="img"
                aria-label={item.name}
              />
              <div className="st-cart-item-body">
                <Link href={`/inventory/${item.slug}`} className="st-cart-item-name">
                  {item.name}
                </Link>
                <div className="st-cart-item-price">{item.priceLabel}</div>
                {meta.length > 0 && (
                  <div className="st-cart-item-meta">{meta.join(" · ")}</div>
                )}
              </div>
              <div className="st-cart-item-actions">
                <Link
                  href={cartItemCheckoutHref(item, cart.eventDate, cart.zip)}
                  className="st-pdp-secondary st-cart-checkout"
                >
                  {c.checkoutItem}
                </Link>
                <button
                  type="button"
                  className="st-cart-remove"
                  onClick={() => removeItem(index)}
                >
                  {c.remove}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="st-cart-footer">
        <button type="button" className="st-text-link" onClick={clear}>
          {c.clearCart}
        </button>
        <Link href="/inventory" className="st-text-link">
          {c.continueShopping} →
        </Link>
      </div>
    </section>
  );
}
