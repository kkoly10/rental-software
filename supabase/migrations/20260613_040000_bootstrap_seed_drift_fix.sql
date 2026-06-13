-- Phase E — reconcile bootstrap_organization category seeds with the
-- vertical registry, and drop the dead legacy car/equipment branches.
--
-- The signup path (this RPC) and the add-vertical-later path
-- (lib/verticals/actions.ts → buildSeedDrafts over the registry's
-- defaultCategorySeeds) seeded DIFFERENT category names/slugs for tents,
-- tables-and-chairs, and dance-floors. So the same org could end up with
-- a different starter catalog depending on which path created the
-- vertical. This recreates the RPC with seed lists + slugs that match
-- lib/verticals/*.ts exactly (slugify = lowercase, non-alphanumeric runs
-- → "-", trimmed), and removes the car/equipment branches that are no
-- longer in the registry or the onboarding allowlist.
--
-- Forward-looking only: existing orgs keep whatever categories they have.

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

  insert into organization_verticals (organization_id, vertical_slug, is_primary)
  values (v_org_id, v_type, true);

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  -- Seed lists below mirror lib/verticals/<slug>.ts defaultCategorySeeds
  -- exactly (name + slugifyCategoryName(name)) so signup and
  -- add-vertical produce the same starter catalog.
  if v_type = 'tents' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Frame Tent',     'frame-tent',     1, 'tents'),
      (v_org_id, 'Pole Tent',      'pole-tent',      2, 'tents'),
      (v_org_id, 'Sailcloth Tent', 'sailcloth-tent', 3, 'tents'),
      (v_org_id, 'Canopy',         'canopy',         4, 'tents'),
      (v_org_id, 'Sidewall',       'sidewall',       5, 'tents');

  elsif v_type = 'tables-and-chairs' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Chiavari Chair',            'chiavari-chair',            1, 'tables-and-chairs'),
      (v_org_id, 'Folding Chair',             'folding-chair',             2, 'tables-and-chairs'),
      (v_org_id, 'Banquet Round Table',       'banquet-round-table',       3, 'tables-and-chairs'),
      (v_org_id, 'Banquet Rectangular Table', 'banquet-rectangular-table', 4, 'tables-and-chairs'),
      (v_org_id, 'Cocktail Table',            'cocktail-table',            5, 'tables-and-chairs');

  elsif v_type = 'dance-floors' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Parquet Dance Floor', 'parquet-dance-floor', 1, 'dance-floors'),
      (v_org_id, 'Black Dance Floor',   'black-dance-floor',   2, 'dance-floors'),
      (v_org_id, 'White Dance Floor',   'white-dance-floor',   3, 'dance-floors'),
      (v_org_id, 'LED Light-Up Floor',  'led-light-up-floor',  4, 'dance-floors'),
      (v_org_id, 'Riser / Stage Section', 'riser-stage-section', 5, 'dance-floors');

  elsif v_type = 'photo-booths' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Open-Air Photo Booth', 'open-air-photo-booth', 1, 'photo-booths'),
      (v_org_id, 'Enclosed Photo Booth', 'enclosed-photo-booth', 2, 'photo-booths'),
      (v_org_id, '360° Video Booth',     '360-video-booth',      3, 'photo-booths'),
      (v_org_id, 'Mirror Photo Booth',   'mirror-photo-booth',   4, 'photo-booths'),
      (v_org_id, 'Selfie Pod',           'selfie-pod',           5, 'photo-booths');

  elsif v_type = 'concessions' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Popcorn Machine',       'popcorn-machine',       1, 'concessions'),
      (v_org_id, 'Snow Cone Machine',     'snow-cone-machine',     2, 'concessions'),
      (v_org_id, 'Cotton Candy Machine',  'cotton-candy-machine',  3, 'concessions'),
      (v_org_id, 'Hot Dog Roller',        'hot-dog-roller',        4, 'concessions'),
      (v_org_id, 'Frozen Drink Machine',  'frozen-drink-machine',  5, 'concessions');

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
