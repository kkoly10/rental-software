-- P0-3: Add expires_at column to availability_blocks for checkout hold expiration.
--
-- Checkout-initiated holds (block_type = 'checkout_hold') get a 30-minute expiration.
-- A cron job (/api/cron/cleanup-holds) runs every 15 minutes and deletes expired blocks.
-- When a Stripe payment webhook confirms payment, the block's expires_at is set to NULL
-- (converting it to a permanent reservation).
--
-- Dashboard-created blocks (order_hold, manual_hold, maintenance, etc.) have NULL expires_at
-- and are permanent until explicitly removed or the order is cancelled.

alter table public.availability_blocks
  add column if not exists expires_at timestamptz;

-- Index for efficient expired-hold cleanup queries
create index if not exists idx_availability_blocks_expires
  on availability_blocks (expires_at)
  where expires_at is not null;

-- Index for the availability check query that filters out expired blocks
create index if not exists idx_availability_blocks_org_product_window
  on availability_blocks (organization_id, product_id, starts_at, ends_at);
