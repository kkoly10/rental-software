-- Fix onboarding bootstrap so authenticated users can create their first organization.
-- Safe to run even if earlier RLS migration was partially applied.

alter table public.organizations enable row level security;

drop policy if exists "Users can view their own organizations" on public.organizations;
drop policy if exists "Anon can view organizations for public storefront" on public.organizations;
drop policy if exists "Authenticated users can insert organizations" on public.organizations;
drop policy if exists "Authenticated users can create organizations during onboarding" on public.organizations;

create policy "Users can view their own organizations"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Anon can view organizations for public storefront"
  on public.organizations for select
  to anon
  using (true);

create policy "Authenticated users can create organizations during onboarding"
  on public.organizations for insert
  to authenticated
  with check (auth.uid() is not null);
