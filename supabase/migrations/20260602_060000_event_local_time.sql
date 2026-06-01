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
-- This migration fixes the data model in three steps:
--
-- 1. Add two TIME columns (event_start_local, event_end_local) that
--    hold the operator's intended wall-clock directly. TIME has no
--    TZ — that's the point.
-- 2. Backfill: the existing event_start_time stored the wall-clock
--    AS its time component (just labelled UTC). Cast its time portion
--    directly into event_start_local. No TZ projection needed.
-- 3. Recompute event_start_time: now that we know the wall-clock and
--    the org's IANA event_timezone, compose the true UTC instant via
--    `(event_date + event_start_local) AT TIME ZONE org.event_timezone`.
--    For orgs whose event_timezone is still 'UTC' (the default from
--    PR 8) this is a no-op. For orgs that set a real tz, it shifts
--    the timestamps to the correct UTC instant.
--
-- After this migration, every downstream reader of event_start_time
-- via formatTimeInTimeZone(ts, org.event_timezone) renders the
-- correct wall-clock — including for the formerly-broken non-UTC
-- orgs.
--
-- Going forward, a BEFORE INSERT/UPDATE trigger keeps event_start_time
-- in sync from event_start_local + the org's tz. App code now sets
-- event_start_local (TIME) and the trigger derives event_start_time.

alter table public.orders
  add column if not exists event_start_local time;
alter table public.orders
  add column if not exists event_end_local time;

comment on column public.orders.event_start_local is
  'Operator''s intended wall-clock event start time. Combined with event_date and organizations.event_timezone to derive event_start_time (timestamptz).';
comment on column public.orders.event_end_local is
  'Operator''s intended wall-clock event end time. See event_start_local.';

-- Step 1: backfill the wall-clock from the legacy "wall-clock-as-UTC" ts.
--         The time component of event_start_time IS the operator's input
--         because that's how it was stored.
update public.orders
   set event_start_local = event_start_time::time
 where event_start_time is not null
   and event_start_local is null;

update public.orders
   set event_end_local = event_end_time::time
 where event_end_time is not null
   and event_end_local is null;

-- Step 2: recompute event_start_time as the true UTC instant.
--         For orgs whose event_timezone is 'UTC' (the default), this is
--         a no-op. For real-TZ orgs, this fixes the value.
update public.orders o
   set event_start_time =
         (o.event_date::timestamp without time zone + o.event_start_local)
         at time zone coalesce(org.event_timezone, 'UTC')
  from public.organizations org
 where org.id = o.organization_id
   and o.event_date is not null
   and o.event_start_local is not null;

update public.orders o
   set event_end_time =
         (o.event_date::timestamp without time zone + o.event_end_local)
         at time zone coalesce(org.event_timezone, 'UTC')
  from public.organizations org
 where org.id = o.organization_id
   and o.event_date is not null
   and o.event_end_local is not null;

-- Step 3: trigger that keeps event_start_time in sync from
--         event_start_local + org.event_timezone on insert / update.
--         App code now sets event_start_local; the timestamptz columns
--         are computed.

create or replace function public.orders_sync_event_times()
returns trigger language plpgsql as $$
declare
  v_tz text;
begin
  if new.event_date is null then
    return new;
  end if;

  -- Look up the org's tz exactly once for this row.
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
  'Derives event_start_time/event_end_time (timestamptz) from event_date + event_start_local/event_end_local (wall-clock) and the org''s event_timezone. App writes should set event_*_local; the trigger maintains the timestamptz columns.';
