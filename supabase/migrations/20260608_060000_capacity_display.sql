-- Phase 1c — capacity-calculator capability.
--
-- Products declaring the display.capacity-calculator capability
-- expose a guest-count calculator on the storefront PDP. Used by
-- tents (guests per tent size) and dance floors (sections per guest).
--
-- capacity_metric enumerates what the capacity_value counts:
--   guests   : tent fits N guests
--   sq_ft    : product covers N square feet
--   dancers  : dance floor fits N dancers
--   servings : concession unit produces N servings
--
-- Capability registration: lib/capabilities/display/capacity-calculator.ts
-- Helper:                   recommendDanceFloorSections (same file)
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

alter table public.products
  add column if not exists capacity_metric text,
  add column if not exists capacity_value  integer;

alter table public.products
  add constraint products_capacity_metric_known
    check (capacity_metric is null or capacity_metric in ('guests', 'sq_ft', 'dancers', 'servings'))
    not valid;
alter table public.products validate constraint products_capacity_metric_known;

alter table public.products
  add constraint products_capacity_value_nonneg
    check (capacity_value is null or capacity_value >= 0)
    not valid;
alter table public.products validate constraint products_capacity_value_nonneg;
