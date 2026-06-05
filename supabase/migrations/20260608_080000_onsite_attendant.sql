-- Phase 1c — onsite-attendant capability.
--
-- Products declaring the service.onsite-attendant capability come
-- with an included attendant for a fixed number of hours, with
-- optional overage billing for hours beyond that. Used by photo
-- booths (attendant typically included for the full rental) and
-- concessions (often 1 hour included, $100/hr after).
--
-- Pricing rule (computed in the capability module):
--   overage_hours = max(0, rental_hours - included_hours)
--   overage_cents = overage_hours × overage_rate
--
-- Capability registration: lib/capabilities/service/onsite-attendant.ts
-- Helper:                   computeAttendantOverage (same file)
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

alter table public.products
  add column if not exists attendant_included_hours         integer,
  add column if not exists attendant_overage_cents_per_hour integer;

alter table public.products
  add constraint products_attendant_included_nonneg
    check (attendant_included_hours is null or (attendant_included_hours >= 0 and attendant_included_hours <= 24))
    not valid;
alter table public.products validate constraint products_attendant_included_nonneg;

alter table public.products
  add constraint products_attendant_overage_nonneg
    check (attendant_overage_cents_per_hour is null or attendant_overage_cents_per_hour >= 0)
    not valid;
alter table public.products validate constraint products_attendant_overage_nonneg;

alter table public.order_items
  add column if not exists attendant_overage_hours numeric(5,2);

alter table public.order_items
  add constraint order_items_attendant_overage_nonneg
    check (attendant_overage_hours is null or attendant_overage_hours >= 0)
    not valid;
alter table public.order_items validate constraint order_items_attendant_overage_nonneg;
