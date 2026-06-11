-- PR-1 #1 — Per-jurisdiction sales-tax rules.
--
-- Operators configure tax rules per state, with optional postal_code
-- precision when a county or city surtax stacks on the state rate.
-- The checkout action looks up the most-specific match for the
-- delivery address; a missing match means rate=0 (operator opt-in).
--
-- Storage strategy:
--   - rate stored in basis points (8.25% → 825) — avoids float drift
--   - state is required, postal_code is optional override
--   - label is operator-facing copy ("Florida sales tax", "Miami-Dade
--     surtax") — shows up on the receipt and invoice
--
-- Lookup precedence at checkout:
--   1. (organization_id, state, postal_code) exact match
--   2. (organization_id, state, postal_code IS NULL) fallback
--   3. no row → tax_amount = 0
--
-- See lib/checkout/tax.ts for the lookup helper.

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  state text not null,
  postal_code text,
  rate_bps integer not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tax_rules_rate_bps_range check (rate_bps >= 0 and rate_bps <= 10000),
  constraint tax_rules_state_format check (length(state) = 2)
);

-- One rule per (org, state, postal_code) — postal_code NULL is the
-- state-wide fallback row. Partial unique indexes handle the NULL.
create unique index tax_rules_org_state_postal_idx
  on public.tax_rules (organization_id, state, postal_code)
  where deleted_at is null and postal_code is not null;

create unique index tax_rules_org_state_fallback_idx
  on public.tax_rules (organization_id, state)
  where deleted_at is null and postal_code is null;

create index tax_rules_org_idx
  on public.tax_rules (organization_id)
  where deleted_at is null;

alter table public.tax_rules enable row level security;

-- Operator-only visibility — customers don't read this table, the
-- checkout action runs as the operator's service role at this point.
create policy tax_rules_select on public.tax_rules
  for select using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = tax_rules.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy tax_rules_insert on public.tax_rules
  for insert with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = tax_rules.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

create policy tax_rules_update on public.tax_rules
  for update using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = tax_rules.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

create policy tax_rules_delete on public.tax_rules
  for delete using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = tax_rules.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

-- updated_at trigger
create trigger tax_rules_set_updated_at
  before update on public.tax_rules
  for each row execute function public.set_updated_at();
