-- Phase 1c — order.minimum-order capability.
--
-- Two flavors, can be combined:
--
--   1. Category-level dollar minimum (tables/chairs commonly require
--      $600 to make delivery economic) — categories.minimum_order_cents
--   2. Product-level quantity minimum (e.g. chairs sold in packs of
--      50 minimum) — products.minimum_order_quantity
--
-- Enforced at checkout via the capability's helpers
-- (enforceOrderMinimum + enforceProductMinQuantity) which return a
-- friendly "add $X more" or "minimum N units" shortfall structure
-- the storefront surfaces near the Continue button.
--
-- Capability registration: lib/capabilities/order/minimum-order.ts
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

alter table public.products
  add column if not exists minimum_order_quantity integer;

alter table public.categories
  add column if not exists minimum_order_cents integer;

alter table public.products
  add constraint products_min_order_qty_nonneg
    check (minimum_order_quantity is null or minimum_order_quantity >= 0)
    not valid;
alter table public.products validate constraint products_min_order_qty_nonneg;

alter table public.categories
  add constraint categories_min_order_cents_nonneg
    check (minimum_order_cents is null or minimum_order_cents >= 0)
    not valid;
alter table public.categories validate constraint categories_min_order_cents_nonneg;
