-- Wave 2 PR 4: balance-due reminder.
--
-- Idempotency guard for the balance-due reminder cron, mirroring
-- orders.deposit_reminder_sent_at. The cron claims an order by setting
-- this column in a conditional UPDATE so concurrent runs can't double-send.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS balance_reminder_sent_at timestamptz;

COMMENT ON COLUMN public.orders.balance_reminder_sent_at IS
  'When the customer balance-due reminder email was sent. NULL = not yet sent. Set by the reminders cron (sendBalanceDueReminders).';
