-- Phase 1a — per-hour pricing capability.
--
-- Adds the schema needed for products that are billed by the hour
-- (photo booths, concessions, mechanical bulls, future AV).
-- Pricing math itself lives in lib/capabilities/pricing/per-hour.ts;
-- this migration just makes the column space available so the
-- product form (Phase 2) and storefront checkout (Phase 2) can read
-- and write it.
--
--   - hourly_rate_cents    : the per-hour rate in cents
--   - minimum_hours        : enforced minimum block (e.g. photo booth
--                            ships with min 3 hours). Hours below this
--                            still bill at the minimum.
--   - idle_hour_rate_cents : optional; a discounted rate for "on-site
--                            but inactive" hours (e.g. photo booth
--                            present during dinner service but not
--                            running). Phase 1a leaves this in the
--                            schema for forward compatibility but the
--                            pricing function ignores it until the
--                            checkout flow has separate active/idle
--                            input fields. Null = idle hours billed
--                            at the full rate, which is the default
--                            most operators expect.
--
-- order_items.billed_hours captures the actual hours the customer was
-- billed (after applying the minimum) so refunds / dispute lookups
-- have the same number the checkout summary showed.
--
-- Design doc: docs/architecture/multi-vertical-capabilities.md §4
-- Capability registration: lib/capabilities/pricing/per-hour.ts

alter table public.products
  add column if not exists hourly_rate_cents    integer,
  add column if not exists minimum_hours        integer,
  add column if not exists idle_hour_rate_cents integer;

-- Sanity checks: rates can't be negative; minimum can't exceed a
-- 24-hour day per single rental. Keeping the upper bound loose
-- (24 hours per day, but rentals can span days via rental_end_date).
alter table public.products
  add constraint products_hourly_rate_nonneg
    check (hourly_rate_cents is null or hourly_rate_cents >= 0)
    not valid;
alter table public.products validate constraint products_hourly_rate_nonneg;

alter table public.products
  add constraint products_minimum_hours_sane
    check (minimum_hours is null or (minimum_hours >= 0 and minimum_hours <= 24))
    not valid;
alter table public.products validate constraint products_minimum_hours_sane;

alter table public.products
  add constraint products_idle_hour_rate_nonneg
    check (idle_hour_rate_cents is null or idle_hour_rate_cents >= 0)
    not valid;
alter table public.products validate constraint products_idle_hour_rate_nonneg;

alter table public.order_items
  add column if not exists billed_hours numeric(5,2);

alter table public.order_items
  add constraint order_items_billed_hours_nonneg
    check (billed_hours is null or billed_hours >= 0)
    not valid;
alter table public.order_items validate constraint order_items_billed_hours_nonneg;
