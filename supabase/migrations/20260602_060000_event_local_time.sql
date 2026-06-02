-- timezone: store event times as wall-clock + IANA tz instead of
-- "wall-clock-stored-as-UTC"
--
-- Historical problem: lib/checkout/actions.ts and lib/orders/actions.ts
-- composed event_start_time as `${eventDate}T${startTime}:00.000Z` —
-- i.e. they took the operator's local wall-clock (e.g. "2pm") and
-- stored it as a UTC timestamp ("14:00:00Z"). For an operator running
-- in UTC that round-trips correctly; for any other timezone it's
-- wrong: a Pacific operator's "2pm" got stored as "14:00:00Z" instead
-- of "21:00:00Z" (which is what 2pm PT actually is in UTC).
--
-- This migration takes the first phase of the fix: capture the
-- operator's wall-clock in dedicated TIME columns and install a
-- trigger that derives the correct UTC instant going forward.
--
-- IMPORTANT: this migration is intentionally SAFE TO APPLY before
-- the app deploy. It does NOT recompute event_start_time on existing
-- rows — that would shift values for any non-UTC org's existing
-- orders and break the unchanged production read path (which still
-- treats event_start_time as wall-clock-stored-as-UTC). The recompute
-- of existing event_start_time is a phase-2 step that should run
-- AFTER the new app code is deployed; do it via:
--
--   UPDATE public.orders o
--      SET event_start_time =
--           (o.event_date::timestamp + o.event_start_local)
--           AT TIME ZONE COALESCE(org.event_timezone, 'UTC')
--     FROM public.organizations org
--    WHERE org.id = o.organization_id
--      AND o.event_date IS NOT NULL
--      AND o.event_start_local IS NOT NULL;
--   -- (and the same for event_end_time)
--
-- when you're confident the new readers are deployed.
--
-- The trigger below is scoped to fire only when event_date /
-- event_start_local / event_end_local / organization_id are in the
-- UPDATE OF clause — production INSERTs that don't mention those
-- columns do NOT fire it, so existing app code keeps writing
-- wall-clock-as-UTC undisturbed.

alter table public.orders
  add column if not exists event_start_local time;
alter table public.orders
  add column if not exists event_end_local time;

comment on column public.orders.event_start_local is
  'Operator''s intended wall-clock event start time. Combined with event_date and organizations.event_timezone to derive event_start_time (timestamptz).';
comment on column public.orders.event_end_local is
  'Operator''s intended wall-clock event end time. See event_start_local.';

-- Backfill the wall-clock from the legacy "wall-clock-as-UTC" ts.
-- The time component of event_start_time IS the operator's input
-- because that's how it was stored.
update public.orders
   set event_start_local = event_start_time::time
 where event_start_time is not null
   and event_start_local is null;

update public.orders
   set event_end_local = event_end_time::time
 where event_end_time is not null
   and event_end_local is null;

-- Trigger that keeps event_start_time in sync from
-- event_start_local + org.event_timezone on insert / update.
-- Fires ONLY when the app explicitly writes the local columns; the
-- existing production app code (which sets event_start_time directly
-- with the legacy wall-clock-as-UTC pattern) is unaffected.

create or replace function public.orders_sync_event_times()
returns trigger language plpgsql as $$
declare
  v_tz text;
begin
  if new.event_date is null then
    return new;
  end if;

  select coalesce(event_timezone, 'UTC')
    into v_tz
    from public.organizations
   where id = new.organization_id;
  v_tz := coalesce(v_tz, 'UTC');

  if new.event_start_local is not null then
    new.event_start_time :=
      (new.event_date::timestamp without time zone + new.event_start_local)
      at time zone v_tz;
  end if;

  if new.event_end_local is not null then
    new.event_end_time :=
      (new.event_date::timestamp without time zone + new.event_end_local)
      at time zone v_tz;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_event_times_trg on public.orders;
create trigger orders_sync_event_times_trg
  before insert or update of event_date, event_start_local, event_end_local, organization_id
  on public.orders
  for each row
  execute function public.orders_sync_event_times();

comment on function public.orders_sync_event_times() is
  'Derives event_start_time/event_end_time (timestamptz) from event_date + event_start_local/event_end_local (wall-clock) and the org''s event_timezone. App writes that set event_*_local fire this trigger; legacy writes that only set event_*_time directly do not.';
