-- PR-1 #3 — Setup/breakdown buffer in availability check.
--
-- products.setup_minutes_before already existed (Sprint 5.5,
-- migration 20260608_050000_setup_window.sql) but the availability
-- check at lib/availability/window.ts ignored it: a Saturday tent
-- with 4h setup did not block Friday late-night, letting the
-- operator double-book their crew.
--
-- This adds the symmetric breakdown_minutes_after column. Both
-- columns are now applied when computing the availability window,
-- so the block's starts_at = event_start - setup_minutes_before
-- and ends_at = event_end + breakdown_minutes_after.

alter table public.products
  add column if not exists breakdown_minutes_after integer;

alter table public.products
  add constraint products_breakdown_minutes_nonneg
    check (breakdown_minutes_after is null or breakdown_minutes_after >= 0)
    not valid;
alter table public.products validate constraint products_breakdown_minutes_nonneg;
