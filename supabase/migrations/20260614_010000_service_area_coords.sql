-- Phase F — store geocoded coordinates on service areas.
--
-- The storefront map previously geocoded each area's ZIP live in the
-- browser on every render (Nominatim, rate-limited), and fell back to
-- the geographic center of the US (Kansas) whenever a lookup failed —
-- which made the pin look completely wrong vs. the operator's ZIP. We
-- now geocode once when the operator saves the area and store the
-- result, so the map renders the correct pin instantly with no live
-- lookup. Nullable: legacy rows without coords fall back to the old
-- client-side geocode path until next save.

alter table public.service_areas
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
