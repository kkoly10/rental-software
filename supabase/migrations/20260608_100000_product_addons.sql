-- Phase 1d — composition.add-ons capability.
--
-- Add-ons are themselves products with their own pricing model — a
-- tent's sidewall add-on is its own products row with pricing.flat-day,
-- a photo booth's extra-hour add-on uses pricing.per-hour. The join
-- table here just links parent → child and carries the storefront
-- presentation rules (default qty, max qty, required flag, sort).
--
-- Order line items reference their add-on parent via
-- order_items.parent_order_item_id (added in migration
-- 20260608_120000_order_item_extensions.sql) so a refund or display
-- can walk the tree.
--
-- Capability registration: lib/capabilities/composition/add-ons.ts
-- Validation helper:        validateAddonSelections (same file)
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

create table if not exists public.product_addons (
  id                uuid primary key default gen_random_uuid(),
  parent_product_id uuid not null references public.products(id) on delete cascade,
  addon_product_id  uuid not null references public.products(id) on delete restrict,
  default_quantity  integer not null default 0,
  max_quantity      integer,
  is_required       boolean not null default false,
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),

  unique (parent_product_id, addon_product_id),

  -- Self-reference would create infinite-loop semantics + pull-sheet
  -- pain. Disallow at the row level.
  check (parent_product_id <> addon_product_id),

  check (default_quantity >= 0),
  check (max_quantity is null or max_quantity >= default_quantity)
);

create index if not exists product_addons_parent_idx
  on public.product_addons (parent_product_id, display_order);

-- RLS — parent-product policy. Org members managing the parent
-- product can manage its add-ons.
alter table public.product_addons enable row level security;

create policy "Org members can manage product addons"
  on public.product_addons for all
  using (
    parent_product_id in (
      select id from public.products
      where organization_id in (select public.get_user_org_ids())
    )
  );
