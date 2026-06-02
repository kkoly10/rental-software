-- Track when the deposit reminder email was sent for each order so the
-- cron only sends one per order. Companion to the existing
-- `day_before_reminder_sent_at` and `follow_up_sent_at` columns the
-- reminders cron already uses.
--
-- Deploy-safety: additive nullable column. No backfill needed.

alter table public.orders
  add column if not exists deposit_reminder_sent_at timestamptz;

create index if not exists idx_orders_pending_deposit_reminder
  on public.orders (organization_id, order_status, created_at)
  where deposit_reminder_sent_at is null
    and order_status = 'awaiting_deposit'
    and deleted_at is null;
