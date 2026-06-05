-- Phase 0 of the multi-vertical capabilities architecture:
-- replace the single `organizations.business_type` column with a
-- join table so an org can declare multiple verticals (the common
-- case — inflatable shops almost always also rent tents/tables/
-- concessions).
--
-- `business_type` stays in place for backwards compatibility. New
-- signups will write both; reads should prefer the join table.
-- Plan: deprecate the column 2 quarters after this lands.
--
-- Design doc: docs/architecture/multi-vertical-capabilities.md §2.3

create table if not exists public.organization_verticals (
  organization_id uuid    not null references public.organizations(id) on delete cascade,
  vertical_slug   text    not null,
  is_primary      boolean not null default false,
  added_at        timestamptz not null default now(),
  primary key (organization_id, vertical_slug)
);

-- Exactly one primary vertical per org. Partial unique index so the
-- "non-primary rows" don't have to coordinate at all.
create unique index if not exists organization_verticals_one_primary
  on public.organization_verticals (organization_id)
  where is_primary;

-- Backfill: every existing org with a business_type gets a primary
-- row in the join table. Idempotent — re-running the migration is a
-- no-op for already-backfilled orgs.
insert into public.organization_verticals (organization_id, vertical_slug, is_primary)
select id, business_type, true
from public.organizations
where business_type is not null
on conflict (organization_id, vertical_slug) do nothing;

-- RLS — mirrors organization_memberships pattern. Org members can
-- read their own verticals; only the bootstrap RPC + future onboarding
-- action writes here (no operator-facing UI yet).
alter table public.organization_verticals enable row level security;

create policy "Org members can view their org verticals"
  on public.organization_verticals for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Owners and admins can manage org verticals"
  on public.organization_verticals for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.profile_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );
