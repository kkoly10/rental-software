-- Phase 3 — multi-vertical signup picker.
--
-- The onboarding form now lets the operator pick from the registry's
-- 4 verticals (inflatable, tents, tables-and-chairs, dance-floors).
-- The previous version of bootstrap_organization only knew about
-- inflatable, car, and equipment — anything else fell through to the
-- inflatable category seed, which would have shipped a wedding-tent
-- operator with "Bounce House", "Water Slide" categories on day one.
--
-- This migration extends the RPC to seed the right defaultCategorySeeds
-- for each registry vertical. Slugs are derived from the category name
-- (lowercase, hyphens) the same way the registry does it.
--
-- The car / equipment branches are preserved for backwards compatibility
-- with anyone who completed onboarding under the legacy form. Once those
-- legacy categories age out, the branches can be deleted.

create or replace function public.bootstrap_organization(
  p_business_name  text,
  p_slug           text    default null,
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
  v_type    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_slug is not null and p_slug <> '' then
    v_slug := p_slug;
  else
    v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
    v_slug := trim(both '-' from v_slug);
    if length(v_slug) < 3 then
      v_slug := v_slug || '-rentals';
    end if;
    v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  v_type := coalesce(p_business_type, 'inflatable');

  insert into organizations (name, slug, timezone, business_type)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'), v_type)
  returning id into v_org_id;

  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  if v_type = 'car' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Economy',     'economy',   1, 'car'),
      (v_org_id, 'SUV',         'suv',       2, 'car'),
      (v_org_id, 'Truck',       'truck',     3, 'car'),
      (v_org_id, 'Luxury',      'luxury',    4, 'car'),
      (v_org_id, 'Van',         'van',       5, 'car');

  elsif v_type = 'equipment' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Generators',      'generators',    1, 'equipment'),
      (v_org_id, 'Lifts & Ladders', 'lifts-ladders', 2, 'equipment'),
      (v_org_id, 'Compressors',     'compressors',   3, 'equipment'),
      (v_org_id, 'Trailers',        'trailers',      4, 'equipment'),
      (v_org_id, 'Tools',           'tools',         5, 'equipment');

  elsif v_type = 'tents' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Frame Tent',        'frame-tent',         1, 'tents'),
      (v_org_id, 'Pole Tent',         'pole-tent',          2, 'tents'),
      (v_org_id, 'Sidewalls',         'sidewalls',          3, 'tents'),
      (v_org_id, 'Tent Lighting',     'tent-lighting',      4, 'tents'),
      (v_org_id, 'Sub-Floor',         'sub-floor',          5, 'tents');

  elsif v_type = 'tables-and-chairs' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Chiavari Chair', 'chiavari-chair', 1, 'tables-and-chairs'),
      (v_org_id, 'Folding Chair',  'folding-chair',  2, 'tables-and-chairs'),
      (v_org_id, 'Round Table',    'round-table',    3, 'tables-and-chairs'),
      (v_org_id, 'Banquet Table',  'banquet-table',  4, 'tables-and-chairs'),
      (v_org_id, 'Linens',         'linens',         5, 'tables-and-chairs');

  elsif v_type = 'dance-floors' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Parquet Dance Floor', 'parquet-dance-floor', 1, 'dance-floors'),
      (v_org_id, 'Black Dance Floor',   'black-dance-floor',   2, 'dance-floors'),
      (v_org_id, 'White Dance Floor',   'white-dance-floor',   3, 'dance-floors'),
      (v_org_id, 'LED Dance Floor',     'led-dance-floor',     4, 'dance-floors'),
      (v_org_id, 'Stage Sections',      'stage-sections',      5, 'dance-floors');

  else
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Bounce House',    'bounce-house',    1, 'inflatable'),
      (v_org_id, 'Water Slide',     'water-slide',     2, 'inflatable'),
      (v_org_id, 'Combo Unit',      'combo-unit',      3, 'inflatable'),
      (v_org_id, 'Obstacle Course', 'obstacle-course', 4, 'inflatable'),
      (v_org_id, 'Game',            'game',            5, 'inflatable');
  end if;

  return v_org_id;
end;
$$;
