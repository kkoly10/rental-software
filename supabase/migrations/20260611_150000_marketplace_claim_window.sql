-- Turo-style 24h post-completion claim window (founder decision
-- 2026-06-11): the deposit no longer releases the instant a seller
-- marks complete — it releases automatically 24h later via the hourly
-- cron, and during that window either party may still open a dispute
-- (completed -> disputed is now a legal transition). Closes the
-- "noticed the damage after completing" trap door.

alter table public.market_bookings
  add column if not exists claim_window_ends_at timestamptz;
