-- Add follow_up_sent_at to orders for tracking post-event follow-up emails
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;

-- Index for efficient cron queries on event_date + status
CREATE INDEX IF NOT EXISTS idx_orders_event_date_status
  ON public.orders (event_date, order_status)
  WHERE event_date IS NOT NULL;
