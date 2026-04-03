-- Communication audit log: records every email, SMS, and portal message
-- so operators can see the complete history of customer touchpoints.

CREATE TABLE IF NOT EXISTS public.communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'portal_message', 'system')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  recipient TEXT,
  subject TEXT,
  body_preview TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching communications by order (order detail page)
CREATE INDEX IF NOT EXISTS idx_communication_log_org_order
  ON public.communication_log (organization_id, order_id, created_at DESC);

-- Index for fetching communications by customer (customer detail page)
CREATE INDEX IF NOT EXISTS idx_communication_log_org_customer
  ON public.communication_log (organization_id, customer_id, created_at DESC);

-- RLS: org members can read their own org's logs
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read communication_log"
  ON public.communication_log FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Allow inserts from any authenticated context (server actions, webhooks, cron)
CREATE POLICY "Authenticated can insert communication_log"
  ON public.communication_log FOR INSERT
  WITH CHECK (true);
