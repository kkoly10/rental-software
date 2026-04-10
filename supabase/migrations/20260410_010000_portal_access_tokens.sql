-- Harden customer portal access with per-order tokenized links
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS portal_access_token_hash text,
  ADD COLUMN IF NOT EXISTS portal_access_token_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_portal_access_token_hash
  ON public.orders (portal_access_token_hash)
  WHERE portal_access_token_hash IS NOT NULL;
