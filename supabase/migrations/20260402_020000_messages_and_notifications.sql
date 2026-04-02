-- ============================================================
-- Messages table for operator <-> customer communication
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_id UUID REFERENCES public.orders(id),
  customer_id UUID REFERENCES public.customers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('portal', 'dashboard', 'email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_org_order_created
  ON public.messages (organization_id, order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_org_unread
  ON public.messages (organization_id, read, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage messages"
  ON public.messages FOR ALL
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Portal (anon) can insert inbound messages
CREATE POLICY "Anon can insert inbound messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (direction = 'inbound');

-- ============================================================
-- Notifications table for persistent notification center
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_read_created
  ON public.notifications (organization_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view notifications"
  ON public.notifications FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members can update notifications"
  ON public.notifications FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Allow inserts from any context (server actions insert on behalf of system)
CREATE POLICY "Allow notification inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (true);
