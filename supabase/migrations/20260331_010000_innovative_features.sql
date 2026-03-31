-- Migration for innovative features: document signing, portal enhancements
-- All brand/pricing/SMS settings are stored in organizations.settings jsonb (no schema change needed)

-- Add document signing columns for customer self-service portal
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS signed_date timestamptz,
ADD COLUMN IF NOT EXISTS signer_name text;

-- Add index for faster portal document lookups by order
CREATE INDEX IF NOT EXISTS idx_documents_order_status
  ON public.documents (order_id, document_status);

-- Add index for portal order lookup by order_number
CREATE INDEX IF NOT EXISTS idx_orders_org_number
  ON public.orders (organization_id, order_number);

-- Add index for route stops ordering (for visual route planner)
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence
  ON public.route_stops (route_id, stop_sequence);

-- Allow public (unauthenticated) document signing from customer portal
-- The server action verifies identity via order_number + email matching
CREATE POLICY "Portal users can update document status via signing"
  ON public.documents FOR UPDATE
  USING (true)
  WITH CHECK (document_status = 'signed');
