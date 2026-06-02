-- customer_addresses.organization_id phase-1: additive column + RLS update.
--
-- Why this column exists. RLS today protects customer_addresses through
-- the customer_id → customers.organization_id chain:
--
--   USING ( customer_id IN (SELECT id FROM customers
--                           WHERE organization_id IN (...)) )
--
-- That works, but every read/write does a sub-select and there's no
-- depth-defense if the chain is bypassed (admin client, misconfigured
-- policy). A direct organization_id column is faster to enforce and
-- catches the cases where an INSERT/UPDATE references a customer row
-- under the wrong org.
--
-- Phase-1 (this file): nullable column + a tolerant RLS policy that
-- accepts either:
--   • the legacy customer_id chain (existing rows pre-backfill), OR
--   • a direct organization_id match (new rows from the updated app code)
--
-- Phase-2 (separate file, applied after phase-1 is deployed and the
-- backfill is verified): tighten to NOT NULL, drop the legacy policy.
--
-- Deploy-safety: ADD COLUMN with no default is metadata-only in modern
-- Postgres. The new policy is additive — existing policies stay in
-- place for read coverage during the rollout.

alter table public.customer_addresses
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade;

create index if not exists idx_customer_addresses_org
  on public.customer_addresses (organization_id)
  where organization_id is not null;

-- New policy: allow access when the row's organization_id (if present)
-- matches the caller's org. Existing "Org members can manage customer
-- addresses" policy stays in place so unbackfilled rows are still
-- reachable via the customer_id chain.
drop policy if exists "Org direct match for customer addresses" on public.customer_addresses;
create policy "Org direct match for customer addresses"
  on public.customer_addresses for all
  using (
    organization_id is null
    or organization_id in (select public.get_user_org_ids())
  )
  with check (
    organization_id is null
    or organization_id in (select public.get_user_org_ids())
  );
