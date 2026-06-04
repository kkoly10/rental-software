-- Fix: bootstrap_organization seeded the primary service area with
-- zip_code populated but postal_codes left empty. The storefront's
-- coverage lookup checks the postal_codes array first, so newly
-- bootstrapped orgs rejected every customer ZIP at checkout until the
-- operator manually re-saved the service area.
--
-- This migration replays the RPC, populating postal_codes with the same
-- single ZIP. Existing rows are backfilled below.

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

  insert into organizations (name, slug, timezone, business_type)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'), coalesce(p_business_type, 'inflatable'))
  returning id into v_org_id;

  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (
      organization_id, label, zip_code, postal_codes,
      delivery_fee, minimum_order_amount
    )
    values (
      v_org_id,
      'Primary area',
      p_zip_code,
      array[p_zip_code],
      coalesce(p_delivery_fee, 25),
      coalesce(p_minimum_order, 100)
    );
  end if;

  if coalesce(p_business_type, 'inflatable') = 'car' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Economy',     'economy',   1, 'car'),
      (v_org_id, 'SUV',         'suv',       2, 'car'),
      (v_org_id, 'Truck',       'truck',     3, 'car'),
      (v_org_id, 'Luxury',      'luxury',    4, 'car'),
      (v_org_id, 'Van',         'van',       5, 'car');

  elsif coalesce(p_business_type, 'inflatable') = 'equipment' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Generators',      'generators',    1, 'equipment'),
      (v_org_id, 'Lifts & Ladders', 'lifts-ladders', 2, 'equipment'),
      (v_org_id, 'Compressors',     'compressors',   3, 'equipment'),
      (v_org_id, 'Trailers',        'trailers',      4, 'equipment'),
      (v_org_id, 'Tools',           'tools',         5, 'equipment');

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

-- Backfill: any service area created by the old RPC has zip_code set
-- but postal_codes empty/null. Copy the single zip into the array so
-- existing tenants stop rejecting checkout.
update service_areas
set postal_codes = array[zip_code]
where zip_code is not null
  and zip_code <> ''
  and (postal_codes is null or array_length(postal_codes, 1) is null);
