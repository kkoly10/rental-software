-- Orders are filtered with `.is("deleted_at", null)` throughout the app
-- (lib/orders, lib/data/*, lib/checkout, lib/portal, the Stripe webhook, the
-- reminder cron, etc.), but the soft-delete foundation migration
-- (20260327_020000) added `deleted_at` to other tables and skipped `orders`.
-- Without the column those queries fail with 42703 on a fresh bootstrap.
-- Idempotent so it is a no-op where the column already exists.
alter table public.orders add column if not exists deleted_at timestamptz;

-- Match the partial-index pattern used for the other soft-deleted tables so
-- the common "active orders for an org, newest first" scans stay fast.
create index if not exists idx_orders_org_active_created_at
  on public.orders (organization_id, created_at desc)
  where deleted_at is null;
