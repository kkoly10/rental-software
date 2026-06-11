-- Handoff identity check (founder decision 2026-06-11, Turo model):
-- the SELLER verifies at handoff that the person picking up matches
-- the ID + live selfie on file, for EVERY rental. Checkout
-- (ready_for_handoff -> checked_out) is gated on this approval. The
-- platform admin's dispute-time view is unchanged.

alter table public.market_bookings
  add column if not exists identity_verified_at timestamptz;
