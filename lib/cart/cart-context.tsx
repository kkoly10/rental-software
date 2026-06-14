"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Client-side storefront cart (Phase 1 of the multi-item cart — see
 * docs/saas/multi-item-cart-spec.md).
 *
 * A cart = ONE event: a shared event date + delivery ZIP and N items. State
 * lives in localStorage (per-origin, so each tenant subdomain is isolated; we
 * also namespace the key). Prices stored here are DISPLAY SNAPSHOTS only — the
 * server re-derives all money at checkout, so a stale/tampered cart price is
 * never trusted.
 */

export type CartAddon = { id: string; qty: number };

export type CartItem = {
  slug: string;
  name: string;
  imageUrl?: string;
  /** Display-only price label snapshot, e.g. "$165/day". Never trusted server-side. */
  priceLabel: string;
  mode?: "dry" | "wet";
  units?: number;
  variantId?: string;
  variantLabel?: string;
  addons?: CartAddon[];
  addedAt: number;
};

export type Cart = {
  eventDate?: string;
  zip?: string;
  items: CartItem[];
};

const STORAGE_KEY = "korent.cart.v1";
const EMPTY: Cart = { items: [] };

type CartContextValue = {
  cart: Cart;
  /** Number of line items (badge count). */
  count: number;
  /** True once localStorage has been read — guards SSR/hydration mismatch. */
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "addedAt">) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  setEvent: (event: { eventDate?: string; zip?: string }) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStored(): Cart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as Cart).items)
    ) {
      return parsed as Cart;
    }
  } catch {
    // Corrupt/blocked storage — start empty rather than throw.
  }
  return EMPTY;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Read once on mount (client only).
  useEffect(() => {
    setCart(readStored());
    setHydrated(true);
  }, []);

  // Persist after hydration so we don't clobber stored state with EMPTY on
  // the first render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage full/blocked — cart still works for the session.
    }
  }, [cart, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "addedAt">) => {
    setCart((c) => ({ ...c, items: [...c.items, { ...item, addedAt: Date.now() }] }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart((c) => ({ ...c, items: c.items.filter((_, i) => i !== index) }));
  }, []);

  const clear = useCallback(() => {
    setCart((c) => ({ ...c, items: [] }));
  }, []);

  const setEvent = useCallback((event: { eventDate?: string; zip?: string }) => {
    setCart((c) => ({ ...c, ...event }));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cart.items.length,
      hydrated,
      addItem,
      removeItem,
      clear,
      setEvent,
    }),
    [cart, hydrated, addItem, removeItem, clear, setEvent],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

/**
 * Build the single-item checkout URL for a cart line, reusing today's
 * single-product checkout flow. Until Phase 3 (multi-item submit), items are
 * checked out individually from this URL. Mirrors the param shape that
 * BookNowWithMode produces so the server action validates it unchanged.
 */
export function cartItemCheckoutHref(
  item: CartItem,
  eventDate?: string,
  zip?: string,
): string {
  const params = new URLSearchParams();
  params.set("product", item.slug);
  if (eventDate) params.set("date", eventDate);
  if (zip) params.set("zip", zip);
  if (item.mode) params.set("mode", item.mode);
  if (item.units && item.units > 0) params.set("units", String(Math.trunc(item.units)));
  if (item.variantId) params.set("variant", item.variantId);
  if (item.addons && item.addons.length > 0) {
    const encoded = item.addons
      .filter((a) => a.qty > 0)
      .map((a) => `${a.id}:${Math.trunc(a.qty)}`)
      .join(",");
    if (encoded) params.set("addons", encoded);
  }
  return `/checkout?${params.toString()}`;
}
