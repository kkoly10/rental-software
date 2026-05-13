-- Multi-vertical foundation
-- Adds fulfillment_type to orders, multi-day rental columns,
-- per-day rate tracking on order_items, and updates the bootstrap
-- RPC to seed vertical-appropriate starter categories.

-- ─── orders: fulfillment type ────────────────────────────────────────────────
alter table orders
  add column if not exists fulfillment_type text not null default 'delivery';

-- ─── orders: multi-day rental date range ─────────────────────────────────────
-- event_date stays for backward compat (inflatable = single event day).
-- rental_end_date is set for multi-day verticals (car, equipment).
alter table orders
  add column if not exists rental_end_date date;

-- ─── order_items: per-day pricing support ────────────────────────────────────
alter table order_items
  add column if not exists rental_days integer,
  add column if not exists rate_per_day numeric(10,2);

-- ─── bootstrap_organization: vertical-aware category seeding ─────────────────
create or replace function public.bootstrap_organization(
  p_business_name  text,
  p_timezone       text    default 'America/New_York',
  p_zip_code       text    default null,
  p_delivery_fee   numeric default 25,
  p_minimum_order  numeric default 100,
  p_business_type  text    default 'inflatable'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_slug    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 3 then
    v_slug := v_slug || '-rentals';
  end if;
  v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into organizations (name, slug, timezone, business_type)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'), coalesce(p_business_type, 'inflatable'))
  returning id into v_org_id;

  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  -- Seed starter categories appropriate for the chosen vertical
  if coalesce(p_business_type, 'inflatable') = 'car' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Economy',     'economy',      1, 'car'),
      (v_org_id, 'SUV',         'suv',          2, 'car'),
      (v_org_id, 'Truck',       'truck',        3, 'car'),
      (v_org_id, 'Luxury',      'luxury',       4, 'car'),
      (v_org_id, 'Van',         'van',          5, 'car');

  elsif coalesce(p_business_type, 'inflatable') = 'equipment' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Generators',      'generators',       1, 'equipment'),
      (v_org_id, 'Lifts & Ladders', 'lifts-ladders',    2, 'equipment'),
      (v_org_id, 'Compressors',     'compressors',      3, 'equipment'),
      (v_org_id, 'Trailers',        'trailers',         4, 'equipment'),
      (v_org_id, 'Tools',           'tools',            5, 'equipment');

  else
    -- Default: inflatable / party rental
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Bounce House',   'bounce-house',   1, 'inflatable'),
      (v_org_id, 'Water Slide',    'water-slide',    2, 'inflatable'),
      (v_org_id, 'Combo Unit',     'combo-unit',     3, 'inflatable'),
      (v_org_id, 'Obstacle Course','obstacle-course',4, 'inflatable'),
      (v_org_id, 'Game',           'game',           5, 'inflatable');
  end if;

  return v_org_id;
end;
$$;
