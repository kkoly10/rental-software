-- Phase 4 — organization_verticals join table.
--
-- Most real operators are multi-vertical (an inflatable shop also rents
-- tents + tables + concessions). The current single-column model on
-- organizations.business_type only captures one. This migration adds a
-- per-org join table so an operator can declare multiple verticals,
-- with exactly one flagged as primary for surfaces that still expect
-- a single answer (dashboard copy, vertical-specific empty states).
--
-- Back-compat:
--   - organizations.business_type is kept as the historical "primary"
--     value and treated as the source of truth for orgs that haven't
--     opted into the new flow.
--   - The bootstrap_organization RPC is updated to insert one
--     organization_verticals row matching business_type so new signups
--     are dual-written from day 1.
--   - A backfill seeds organization_verticals from every existing org's
--     business_type so dashboard helpers can read from the new table
--     immediately.
--
-- Future slices wire dashboard / capability dispatch / category seeding
-- to read the full vertical list from this table instead of just
-- business_type.
--
-- Design doc: docs/architecture/multi-vertical-capabilities.md §2.3

create table if not exists public.organization_verticals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical_slug   text not null,
  is_primary      boolean not null default false,
  added_at        timestamptz not null default now(),
  primary key (organization_id, vertical_slug)
);

-- At most one primary vertical per org. Partial unique index so the
-- non-primary rows don't coordinate at all (mirrors the
-- product_variants_one_default pattern from #280).
create unique index if not exists organization_verticals_one_primary
  on public.organization_verticals (organization_id)
  where is_primary;

-- Sanity bound so a typo doesn't store a multi-paragraph slug; matches
-- the longest registry slug ("tables-and-chairs" = 17 chars) with
-- headroom for future verticals.
alter table public.organization_verticals
  add constraint organization_verticals_slug_sane
    check (length(vertical_slug) between 1 and 64)
    not valid;
alter table public.organization_verticals
  validate constraint organization_verticals_slug_sane;

create index if not exists organization_verticals_org_idx
  on public.organization_verticals (organization_id);

-- RLS — org members can see (and only see) their own org's verticals.
-- Following the same get_user_org_ids() helper used by every other
-- org-scoped table.
alter table public.organization_verticals enable row level security;

create policy "Org members can read organization_verticals"
  on public.organization_verticals for select
  using (
    organization_id in (select public.get_user_org_ids())
  );

create policy "Org owners can manage organization_verticals"
  on public.organization_verticals for all
  using (
    organization_id in (
      select organization_id
      from public.organization_memberships
      where profile_id = auth.uid()
        and role = 'owner'
        and status = 'active'
    )
  );

-- Backfill from existing organizations.business_type so dashboard
-- helpers can read from the new table immediately. on conflict do
-- nothing keeps the migration idempotent for any rerun.
insert into public.organization_verticals (organization_id, vertical_slug, is_primary)
select id, coalesce(business_type, 'inflatable'), true
from public.organizations
where deleted_at is null
on conflict (organization_id, vertical_slug) do nothing;

-- Update bootstrap_organization to insert the join row at signup so
-- the dual-write starts from day 1. Everything else in the RPC is
-- unchanged from migration 20260608_140000.
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

  -- Phase 4 — dual-write the primary vertical to organization_verticals.
  insert into organization_verticals (organization_id, vertical_slug, is_primary)
  values (v_org_id, v_type, true);

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
