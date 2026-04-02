-- Add latitude and longitude to customer_addresses for geocoding cache.
-- Route detail loads coordinates from here to plot delivery stops on the map.

alter table public.customer_addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.customer_addresses.latitude is 'Geocoded latitude, populated lazily from postal code via Nominatim';
comment on column public.customer_addresses.longitude is 'Geocoded longitude, populated lazily from postal code via Nominatim';
