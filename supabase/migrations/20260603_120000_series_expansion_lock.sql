-- Sprint 5.10 — order_series expansion lock (#20)
--
-- expandSeriesInternal() had a SELECT-then-UPDATE race on
-- order_series.last_generated_through. Two concurrent expansions
-- (e.g. the daily cron racing with a manually-triggered "regenerate"
-- button) would both read the same cursor, both enumerate the same
-- forward range, both insert duplicate child orders for the same
-- occurrence_number, and both write the same new last_generated_through
-- — leaving the customer with two orders for every event in the
-- generated window.
--
-- The fix is a per-series advisory lock implemented as a conditional
-- column update: callers attempt to set expansion_locked_at = now()
-- WHERE the lock is currently null or older than the stale threshold.
-- If the UPDATE matches a row the caller owns the lock; if it matches
-- zero rows someone else is expanding (or the lock is fresh from a
-- crashed run that hasn't yet expired). The caller bails out instead
-- of running the expansion.
--
-- The lock auto-expires after 10 minutes so a crashed Vercel function
-- doesn't pin the series forever. The expansion itself rarely runs
-- more than a second or two, so 10 minutes is comfortable headroom.

alter table public.order_series
  add column if not exists expansion_locked_at timestamptz;

comment on column public.order_series.expansion_locked_at is
  'Set when expandSeriesInternal acquires its per-series advisory lock; cleared on completion. Auto-expires after 10 minutes so a crashed Vercel function does not pin the series. Concurrent expansions take the lock conditionally and abort if it is already held by someone else.';
