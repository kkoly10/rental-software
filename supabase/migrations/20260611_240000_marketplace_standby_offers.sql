-- Roadmap item 6 (master plan §10): standby queue activation.
-- Research-locked: sequential offers with a claim window (hotel
-- pattern), broadcast fallback inside 48h of the rental start —
-- Resy-style broadcast races frustrate at small scale. v1 offers are
-- exclusive NOTIFICATIONS (no blocking offer-hold: a hold would also
-- block the claimant's own booking in the capacity math); the claim
-- is simply booking normally while you're first in line.

alter table public.market_reservation_standby
  add column if not exists quantity_available_note text,
  add column if not exists offered_at timestamptz,
  add column if not exists offer_expires_at timestamptz;

create index if not exists market_standby_queue_idx
  on public.market_reservation_standby (listing_id, created_at)
  where promoted_at is null;
