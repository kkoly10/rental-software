-- Phase 1c — setup-window capability.
--
-- Products declaring the setup.setup-window capability have a fixed
-- pre-event arrival window. Used by tents (2–4 hours), dance floors
-- (1–2 hours), and photo booths (~60 min). Pull-sheet rendering
-- subtracts this from event_start to display the crew arrival time.
--
-- Capability registration: lib/capabilities/setup/setup-window.ts
-- Helper:                   computeCrewArrivalIso (same file)
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

alter table public.products
  add column if not exists setup_minutes_before integer;

-- Sanity: non-negative; capped at 24 hours (any arrival > a day
-- before is almost certainly a typo and would put a crew member
-- at the wrong site).
alter table public.products
  add constraint products_setup_minutes_sane
    check (setup_minutes_before is null or (setup_minutes_before >= 0 and setup_minutes_before <= 24 * 60))
    not valid;
alter table public.products validate constraint products_setup_minutes_sane;
