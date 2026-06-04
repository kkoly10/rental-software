-- Constrain route_stops.stop_type to the known set.
--
-- Decision 2.6 (multi-day rentals) added "pickup" as a valid value
-- alongside the existing "delivery". Both have been in active use, but
-- the column itself was an unrestricted text. Adding the CHECK prevents
-- a future migration / hand-written insert from sneaking in an
-- unrecognized value (which would silently break the auto-attach
-- helper's stop_type branches).
--
-- NOT VALID + VALIDATE keeps the migration cheap even on tenants with
-- millions of historical rows — existing data is checked exactly once,
-- then new writes are guarded going forward.

ALTER TABLE public.route_stops
  ADD CONSTRAINT route_stops_stop_type_check
  CHECK (stop_type IN ('delivery', 'pickup'))
  NOT VALID;

-- Validate any pre-existing rows. If this fails on the production
-- database, the rejected rows should be cleaned up (or the constraint
-- relaxed to include the historical value) before re-running.
ALTER TABLE public.route_stops
  VALIDATE CONSTRAINT route_stops_stop_type_check;
