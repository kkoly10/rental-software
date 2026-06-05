-- Phase 0 of the multi-vertical capabilities architecture:
-- give products + categories a list of capability slugs so the form,
-- pricing engine, storefront PDP, and pull-sheet can dispatch to the
-- right capability handlers.
--
-- Capabilities are small, composable behaviors (wet/dry mode,
-- anchoring, surface type, per-hour pricing, etc.) defined in code
-- under lib/capabilities/<group>/<name>.ts. A product declares which
-- capabilities apply via this column. When a new vertical lands, no
-- product-table schema change is needed — only new rows in
-- product.capability_slugs.
--
-- Design doc: docs/architecture/multi-vertical-capabilities.md §2.4

alter table public.products
  add column if not exists capability_slugs text[] not null default '{}';

alter table public.categories
  add column if not exists default_capability_slugs text[] not null default '{}';

-- Backfill: existing inflatable products get the capability set
-- corresponding to the inflatable vertical's current behavior.
-- (Phase 0 doesn't change runtime behavior — these slugs are
-- consumed in Phase 1+ once dispatchers exist.)
update public.products p
set capability_slugs =
  array['pricing.flat-day', 'setup.anchoring', 'setup.surface-type', 'mode.wet-dry']
from public.categories c
where p.category_id = c.id
  and c.vertical = 'inflatable'
  and p.capability_slugs = '{}';

update public.categories
set default_capability_slugs =
  array['pricing.flat-day', 'setup.anchoring', 'setup.surface-type', 'mode.wet-dry']
where vertical = 'inflatable'
  and default_capability_slugs = '{}';

-- GIN index for the (eventual) "find products with capability X"
-- lookup pattern. Cheap to add now while the table is empty-ish of
-- non-default values; expensive later.
create index if not exists products_capability_slugs_gin
  on public.products using gin (capability_slugs);
