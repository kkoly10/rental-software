-- Roadmap item 3 (master plan §24): time-based pickup/return reminders.
-- Emails previously fired only on state changes; the comms matrix also
-- requires day-before-pickup and return-day reminders. Sent-at flags
-- make the hourly cron exactly-once (claim via conditional update).

alter table public.market_bookings
  add column if not exists pickup_reminder_sent_at timestamptz,
  add column if not exists return_reminder_sent_at timestamptz,
  add column if not exists return_due_nudge_sent_at timestamptz;

create index if not exists market_bookings_pickup_reminder_idx
  on public.market_bookings (starts_at)
  where pickup_reminder_sent_at is null
    and state in ('confirmed','ready_for_handoff');

create index if not exists market_bookings_return_reminder_idx
  on public.market_bookings (ends_at)
  where return_reminder_sent_at is null and state = 'checked_out';
