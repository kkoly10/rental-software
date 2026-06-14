"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart } from "@/lib/cart/cart-context";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Phase 3b — combined multi-item checkout (client flow).
 *
 * Reads the WHOLE cart from useCart(), serializes it into the `cart_json`
 * payload the server action validates + re-prices, and renders the SAME
 * shared contact / address / event-date form the single-item checkout
 * uses (CheckoutForm). The server is the sole source of truth for money:
 * the cart carries NO prices the server trusts.
 *
 * Guards:
 *  - Until hydrated, render nothing-of-substance (cart lives in
 *    localStorage; avoids an SSR mismatch).
 *  - An empty cart routes the customer back to the cart page.
 *  - A missing shared event date / ZIP sends them back to set them (the
 *    cart page owns those inputs); they're required to price delivery +
 *    availability.
 */
export function MultiItemCheckout({
  minDate,
  maxDate,
  cancellationPolicy,
}: {
  minDate?: string;
  maxDate?: string;
  cancellationPolicy?: string;
}) {
  const { cart, hydrated } = useCart();
  const { messages: m } = useI18n();
  const mi = m.checkout.multiItem;

  // Serialize the cart into the exact per-item shape parseCartJson reads.
  // Prices are deliberately excluded — the server re-derives them.
  const cartJson = useMemo(() => {
    return JSON.stringify(
      cart.items.map((it) => ({
        slug: it.slug,
        mode: it.mode,
        units: it.units,
        variantId: it.variantId,
        addons: it.addons,
      })),
    );
  }, [cart.items]);

  const itemNames = useMemo(() => cart.items.map((it) => it.name), [cart.items]);

  if (!hydrated) {
    return (
      <section className="panel">
        <p className="muted">{m.cart.loading}</p>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="panel">
        <div className="kicker">{m.cart.title}</div>
        <h1 style={{ margin: "8px 0 10px" }}>{m.cart.empty}</h1>
        <p style={{ marginTop: 12 }}>
          <Link href="/inventory" className="st-text-link">
            {m.cart.browse} →
          </Link>
        </p>
      </section>
    );
  }

  // Date + ZIP live at the cart level (a cart = one event). They're
  // required to price delivery + check availability, so if they're not
  // set, send the customer back to the cart to enter them.
  if (!cart.eventDate || !cart.zip) {
    return (
      <section className="panel">
        <div className="kicker">{m.cart.title}</div>
        <h1 style={{ margin: "8px 0 10px" }}>{mi.needEventInfoTitle}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {mi.needEventInfoBody}
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/cart" className="primary-btn">
            {mi.backToCart}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="kicker">{m.checkout.kicker}</div>
      <h1 style={{ margin: "8px 0 10px" }}>{mi.title}</h1>
      <div className="muted">{mi.description}</div>

      <CheckoutForm
        initialDate={cart.eventDate}
        initialZip={cart.zip}
        minDate={minDate}
        maxDate={maxDate}
        cancellationPolicy={cancellationPolicy}
        cartJson={cartJson}
        cartItemNames={itemNames}
      />
    </section>
  );
}
