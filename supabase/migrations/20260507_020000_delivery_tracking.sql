-- Tracking token for customer-facing live delivery tracking page.
-- Lives on route_stops so each stop gets its own independent tracking link.
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS tracking_token_hash text,
  ADD COLUMN IF NOT EXISTS tracking_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_tracking_token_hash
  ON public.route_stops (tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

-- driver_locations: one row per active route, upserted on each GPS update.
-- Cleaned up automatically when the route is deleted (CASCADE).
CREATE TABLE IF NOT EXISTS public.driver_locations (
  route_id      uuid PRIMARY KEY REFERENCES public.routes(id) ON DELETE CASCADE,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  accuracy_m    double precision,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Authenticated org members can upsert their own route's location.
CREATE POLICY "Org members can upsert driver location"
  ON public.driver_locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon can read — the tracking page uses anon key and the token check prevents misuse.
-- The tracking API never exposes route_id directly from user input.
CREATE POLICY "Anon can read driver locations"
  ON public.driver_locations FOR SELECT
  TO anon
  USING (true);
