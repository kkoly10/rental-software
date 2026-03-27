alter table public.service_areas
  add column if not exists postal_codes text[] not null default '{}';

update public.service_areas
set postal_codes = array[zip_code]
where zip_code is not null
  and trim(zip_code) <> ''
  and cardinality(postal_codes) = 0;

create index if not exists idx_service_areas_org_active_zip
  on public.service_areas (organization_id, is_active, zip_code);

create index if not exists idx_service_areas_org_city_state
  on public.service_areas (organization_id, is_active, city, state);

create index if not exists idx_service_areas_postal_codes_gin
  on public.service_areas using gin (postal_codes);

create index if not exists idx_availability_blocks_org_product_window
  on public.availability_blocks (organization_id, product_id, starts_at, ends_at);

create index if not exists idx_availability_blocks_org_order
  on public.availability_blocks (organization_id, source_order_id);
