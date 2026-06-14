# Multi-Item Cart — Design & Phased Plan

**Created:** 2026-06-14 · **Owner:** founder + Claude · **Status:** Phase 1 shipped; Phase 2 next

The storefront checkout is single-product today: renting a bounce house +
tables + a tent = three separate checkouts (three deposits, three delivery
fees, three confirmations). For party rentals — where one event needs
several items — that's the biggest remaining conversion gap (storefront
teardown, P1). This spec defines a multi-item cart and decomposes it into
independently-shippable PRs.

> **Recon verdict (this session):** the **order data model already supports
> N independent products per order** — `order_items.product_id` varies per
> row, parent→child linkage exists via `parent_order_item_id` (used today
> for add-ons / variant / damage-waiver child lines), and **deposit,
> delivery fee, and tax are already computed at the ORDER level**, not per
> item. So **no schema migration is required** for the core. The work is
> entirely app-layer: there is no cart state today, the checkout URL/form
> accepts a single `product_slug`, and the submit action looks up exactly
> one parent product.

---

## A. Key architecture decisions

1. **A cart = one event.** All items in a cart share a single **event date**
   and **delivery ZIP/address** (you're booking one party). Date + ZIP live
   at the **cart level**, not per item. This matches the data model
   (`orders.event_date`, one `delivery_address_id`, one service-area fee)
   and keeps deposit/delivery/tax order-level as they already are.

2. **Client cart state, persisted in `localStorage`.** Greenfield — there
   is zero cart scaffolding today. A React context (`CartProvider`) backed by
   `localStorage` holds the cart. `localStorage` is per-origin, so each
   tenant subdomain (`acme.korent.app` vs `demo.korent.app`) gets an isolated
   cart automatically; we still namespace the key defensively. No DB
   persistence in v1 (logged-in cart sync is a later, optional phase).

3. **Cart item shape mirrors the existing PDP→checkout selections** so the
   submit path can reuse today's per-item pricing/validation verbatim:
   ```ts
   type CartItem = {
     slug: string;            // product identity
     name: string;            // snapshot for display
     imageUrl?: string;
     priceLabel: string;      // snapshot for display only ("$165/day")
     mode?: "dry" | "wet";
     units?: number;          // per-unit products
     variantId?: string;
     addons?: { id: string; qty: number }[];
     addedAt: number;
   };
   type Cart = { eventDate?: string; zip?: string; items: CartItem[] };
   ```
   **Prices in the cart are display snapshots only.** The server is the sole
   source of truth for money at submit time (it already re-derives every
   line from the DB — preserves the "server-validated pricing" guarantee and
   the fee-accuracy constraint). The cart never sends prices the server trusts.

4. **Checkout receives the cart via POST, not the URL.** Today checkout is a
   GET page reading `?product=&units=&variant=&addons=…`. A multi-item cart
   with per-item variants/add-ons doesn't fit cleanly (or safely) in a query
   string. The cart page POSTs the cart JSON (items + eventDate + zip) to the
   checkout. Single-product "Book Now" keeps working unchanged (it's just a
   one-item cart path), so we don't regress the existing flow.

5. **All-or-nothing availability.** Before creating the order, **every** item
   is availability-checked for the event date; if any item is unavailable the
   whole submit fails with a clear per-item message (no partial orders, no
   "item 2 sold out between cart and submit" surprise).

6. **Stripe stays one deposit charge on the order total** — unchanged. The
   deposit is already a single line item computed from the order total
   (`getBookingPolicies().depositPercentage`), which is exactly right for a
   multi-item order.

---

## B. What changes (app-layer only)

| Layer | Today | Multi-item |
|---|---|---|
| Cart state | none | new `CartProvider` (context + localStorage) |
| Add to cart | none ("Book Now" → /checkout for one item) | "Add to cart" on PDP + cart drawer/page |
| Chrome | single "Book" CTA | cart indicator w/ item count |
| Checkout input | `?product=…` (GET) | cart JSON via POST (one-item path preserved) |
| Pricing | `getCheckoutPricing(slug,…)` once | loop per item, sum; deposit/delivery/tax once on the order (already order-level) |
| Submit action | one parent product lookup + insert | loop: N parent `order_items` (+ each one's add-on/variant/waiver children) |
| `orders` / `order_items` schema | — | **no change** |
| Stripe | one deposit line | **no change** |

---

## C. Phased PRs (each independently shippable, merge-on-green)

- **Phase 1 — Cart state + UI shell (no checkout change). ✅ SHIPPED.**
  `CartProvider` (`lib/cart/cart-context.tsx`; context + localStorage,
  namespaced, SSR-safe via a `hydrated` flag), "Add to cart" on the PDP
  inside `BookNowWithMode` (it owns the mode/units/variant/add-on
  selections), a header cart indicator with item-count badge
  (`cart-indicator.tsx`, desktop + mobile), and a `/cart` page
  (`cart-view.tsx`) listing items with remove/clear, the shared event date +
  ZIP, and a per-item "Check out" that reuses today's single-item flow
  (`cartItemCheckoutHref`) with a plain note that combined one-payment
  checkout arrives in Phase 3. Pure client; zero backend risk. i18n added
  (en/es/fr/pt). Prices in the cart are display snapshots only.

- **Phase 2 — Server pricing preview for a cart.** A read-only action/route
  that takes the cart (items + date + zip), loops `getCheckoutPricing` per
  item, and returns aggregated subtotal / delivery / tax / deposit / total.
  Cart drawer + `/cart` show a live, server-true total. No order creation.

- **Phase 3 — Multi-item checkout + submit (the core).** Checkout page
  accepts the POSTed cart and renders N item summaries with one event/
  address form. `createCheckoutOrder` parses N items, reuses the existing
  per-item pricing/validation for each, inserts one `orders` row (aggregate
  totals) + N parent `order_items` (+ their existing add-on/variant/waiver
  children), keeps the single Stripe deposit. Single-item path preserved.

- **Phase 4 — All-or-nothing availability + reservation.** Validate every
  item's availability up front; reserve atomically or fail the whole order
  with per-item reasons.

- **Phase 5 (optional, later) — Logged-in cart sync + abandoned-cart
  recovery.** Persist the cart server-side for signed-in customers; optional
  recovery email. Lower priority.

---

## D. Open decisions for the founder

1. **Tier-gating?** Is the multi-item cart available on all tiers, or a
   Pro/Growth upsell? (The single-item "Book Now" stays on all tiers
   regardless.) Recommendation: **all tiers** — it's table-stakes commerce,
   not a builder feature.
2. **Mixed event dates?** v1 assumes one event date per cart (recommended).
   Confirm we don't need per-item dates in v1 (it complicates availability,
   delivery, and the UI significantly).
3. **Cart vs. quote.** Should a large cart be able to fall back to "request a
   quote" (the existing quote flow) instead of instant checkout? Recommend
   keeping them separate in v1; revisit after Phase 3.

---

## E. Constraints carried in (do not violate)
- Server re-derives all money at submit (never trust cart prices).
- Fee/deposit math must match the disclosed copy (deposit %, delivery fee).
- Funds only via Stripe Connect to the operator — never a Korent account.
- No overstated insurance/inspection claims anywhere in cart/checkout copy.
