-- bootstrap_organization RPC
-- Called by lib/onboarding/actions.ts during new-operator onboarding.
-- Creates the organization, assigns the authenticated user as owner,
-- seeds a default service area and starter product categories.
-- Returns the new organization's UUID.

create or replace function public.bootstrap_organization(
  p_business_name text,
  p_timezone text default 'America/New_York',
  p_zip_code text default null,
  p_delivery_fee numeric default 25,
  p_minimum_order numeric default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_slug text;
begin
  -- Require an authenticated caller
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate a temporary slug from the business name.
  -- The onboarding action will overwrite this with the user-chosen slug
  -- immediately after, but we need a value for the NOT NULL constraint.
  v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 3 then
    v_slug := v_slug || '-rentals';
  end if;
  -- Append random suffix to avoid unique constraint collisions
  v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create the organization
  insert into organizations (name, slug, timezone)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'))
  returning id into v_org_id;

  -- Add the caller as owner
  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  -- Seed a default service area if a ZIP was provided
  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  -- Seed starter product categories
  insert into categories (organization_id, name, slug, sort_order) values
    (v_org_id, 'Bounce House',  'bounce-house',  1),
    (v_org_id, 'Water Slide',   'water-slide',   2),
    (v_org_id, 'Combo Unit',    'combo-unit',     3),
    (v_org_id, 'Obstacle Course','obstacle-course',4),
    (v_org_id, 'Game',          'game',           5);

  return v_org_id;
end;
$$;
