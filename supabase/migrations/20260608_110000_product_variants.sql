-- Phase 1d — display.variant-gallery capability.
--
-- One row per visual option: a backdrop image for a photo booth, a
-- color for a tent, a surface (parquet/black/white/LED) for a dance
-- floor. The storefront renders these as a clickable thumbnail
-- picker; price_delta_cents adds (or subtracts) from the base price
-- when the customer picks a non-default variant.
--
-- Capability registration: lib/capabilities/display/variant-gallery.ts
-- Design doc:               docs/architecture/multi-vertical-capabilities.md §4

create table if not exists public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  variant_label     text not null,
  thumbnail_url     text,
  preview_image_url text,
  price_delta_cents integer not null default 0,
  is_default        boolean not null default false,
  display_order     integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, display_order);

-- At most one default per product. Partial unique index so the
-- non-default rows don't coordinate at all.
create unique index if not exists product_variants_one_default
  on public.product_variants (product_id)
  where is_default;

-- Sanity bounds so a typo doesn't render a paragraph next to a
-- thumbnail. 64 chars is plenty ("Sequin Gold", "Tropical Leaf",
-- "Black Roman Stripe", etc.).
alter table public.product_variants
  add constraint product_variants_label_sane
    check (length(variant_label) between 1 and 64)
    not valid;
alter table public.product_variants validate constraint product_variants_label_sane;

-- RLS — parent-product policy.
alter table public.product_variants enable row level security;

create policy "Org members can manage product variants"
  on public.product_variants for all
  using (
    product_id in (
      select id from public.products
      where organization_id in (select public.get_user_org_ids())
    )
  );
