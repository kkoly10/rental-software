-- G2 step 1 — storefront editorial builder: page documents (theme half first).
--
-- The storefront builder promotes the partial token/section set out of
-- organizations.settings into a first-class, draft/published page document
-- (see docs/saas/storefront-builder-spec.md §2 storage, §6 safety).
--
-- One row per (organization, page_key). `page_key` defaults to 'home' with
-- room for /about + landing pages later. The public storefront only ever
-- reads `published`; the builder edits `draft` and copies draft -> published
-- on publish (setting published_at).
--
-- PR-A is pure plumbing: until an org publishes tokens, the storefront
-- renders exactly as today (the reader returns null on any miss).

create table if not exists public.storefront_pages (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_key        text not null default 'home',
  draft           jsonb not null default '{}'::jsonb,
  published       jsonb not null default '{}'::jsonb,
  published_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, page_key)
);

-- RLS — mirrors document_templates: members can read their org's pages;
-- only owners/admins can write them. The public storefront reads `published`
-- through the service-role admin client (anon path), which bypasses RLS.
alter table public.storefront_pages enable row level security;

drop policy if exists "Org members can view their storefront pages" on public.storefront_pages;
create policy "Org members can view their storefront pages"
  on public.storefront_pages for select
  using (organization_id in (select public.get_user_org_ids()));

drop policy if exists "Owners and admins can manage storefront pages" on public.storefront_pages;
create policy "Owners and admins can manage storefront pages"
  on public.storefront_pages for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.profile_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );
