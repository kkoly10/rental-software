-- Phase 1b — per-unit pricing capability.
--
-- Adds the schema needed for products billed per individual unit
-- (each chair, each table, each dance-floor section, each linen).
-- Used by tables & chairs, dance floors, and any future bulk-item
-- vertical. Differs from flat-day pricing in that the storefront
-- shows the unit label ("$5 per chair × 100 = $500") rather than a
-- bare per-item rate, and order minimums (the order.minimum-order
-- capability — Phase 1d) often pair with this model.
--
--   - unit_price_cents : the per-unit rate in cents
--   - unit_label       : singular display label ("chair", "section",
--                        "table"); the storefront pluralizes via the
--                        i18n layer
--
-- order_items.billed_units captures the number of units billed so
-- refund / dispute lookups see the same number the checkout summary
-- showed. Stored as integer because all v1 per-unit verticals deal
-- in whole units (chairs/sections/tables). Linens (yards) would
-- want fractional; deferred to Tier C and a future numeric column.
--
-- Pricing math lives in lib/capabilities/pricing/per-unit.ts.
--
-- Design doc: docs/architecture/multi-vertical-capabilities.md §4
-- Capability registration: lib/capabilities/pricing/per-unit.ts

alter table public.products
  add column if not exists unit_price_cents integer,
  add column if not exists unit_label       text;

alter table public.products
  add constraint products_unit_price_nonneg
    check (unit_price_cents is null or unit_price_cents >= 0)
    not valid;
alter table public.products validate constraint products_unit_price_nonneg;

-- Sanity check on the unit label so a fat-finger doesn't end up
-- displaying a paragraph of text on the PDP. 32 chars is plenty
-- ("dance floor section", "banquet round table", etc.).
alter table public.products
  add constraint products_unit_label_short
    check (unit_label is null or length(unit_label) <= 32)
    not valid;
alter table public.products validate constraint products_unit_label_short;

alter table public.order_items
  add column if not exists billed_units integer;

alter table public.order_items
  add constraint order_items_billed_units_nonneg
    check (billed_units is null or billed_units >= 0)
    not valid;
alter table public.order_items validate constraint order_items_billed_units_nonneg;
