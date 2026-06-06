-- Phase 1c — structured-specs capability.
--
-- product_specs is a child table of products: one row per
-- (key, label, value) entry on the storefront PDP. Replaces
-- ad-hoc per-product attribute storage for things like power
-- requirements, dimensions, footprint, included consumables,
-- and servings-per-unit.
--
-- Used by every vertical that wants a definition-list of specs on
-- the PDP (which is essentially all of them in Phase 2).
--
-- Capability registration: lib/capabilities/display/structured-specs.ts
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

create table if not exists public.product_specs (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  spec_key      text not null,
  spec_label    text not null,
  spec_value    text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists product_specs_product_id_order_idx
  on public.product_specs (product_id, display_order);

-- Sanity bounds so a fat-finger doesn't render a paragraph in the
-- spec table. Operators always have the description field for prose.
alter table public.product_specs
  add constraint product_specs_lengths_sane
    check (
      length(spec_key)   between 1 and 64
      and length(spec_label) between 1 and 64
      and length(spec_value) between 1 and 256
    )
    not valid;
alter table public.product_specs validate constraint product_specs_lengths_sane;

-- RLS — parent-product policy.
-- Org members managing their org's products can manage the specs.
-- Anon storefront reads use the service-role/RPC path, no policy
-- needed here for that read path (consistent with how products
-- themselves are read by anonymous storefront traffic).
alter table public.product_specs enable row level security;

create policy "Org members can manage their product specs"
  on public.product_specs for all
  using (
    product_id in (
      select id from public.products
      where organization_id in (select public.get_user_org_ids())
    )
  );
