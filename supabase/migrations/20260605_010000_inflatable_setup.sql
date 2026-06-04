-- Sprint 6.0 — Inflatable anchoring + wet/dry modes
--
-- Two new optional product attributes for the inflatable vertical:
--
--   1. anchoring_methods + required_anchor_count — operator-set, surfaced
--      on the crew dispatch sheet so the loader sees "Bring: stakes x6"
--      without memorizing per-unit setup. Modeled as a constrained
--      text[] (no free-text drift, but a 5-element CHECK that can be
--      widened by future migration if operators request more methods).
--
--   2. supports_modes + wet_upcharge_cents on products, plus
--      selected_mode on order_items — a single product row with a
--      customer-facing mode toggle. Beats InflatableOffice's two-SKU
--      pattern on operator UX (one product, one inventory truth)
--      while still differentiating wet vs dry pricing via a per-unit
--      upcharge stored in cents.
--
-- Full design rationale + competitor comparison + research citations:
-- docs/architecture/inflatable-anchoring-and-modes.md
--
-- Migration safety:
--   - All additions are additive with defaults; existing rows behave
--     exactly as they do today.
--   - supports_modes defaults to {dry} so every existing product is
--     single-mode out of the box.
--   - anchoring_methods defaults to empty array — products without
--     anchoring configured render no "Bring:" line on the pull sheet.
--   - order_items.selected_mode is nullable — existing order line
--     items continue to work without modification.
--   - CHECK constraints reject malformed inserts but accept every
--     defaulted row.

alter table public.products
  add column if not exists supports_modes text[] not null default '{dry}'::text[],
  add column if not exists wet_upcharge_cents integer,
  add column if not exists anchoring_methods text[] not null default '{}'::text[],
  add column if not exists required_anchor_count integer;

comment on column public.products.supports_modes is
  'Sprint 6.0 — inflatable wet/dry modes. Constrained to subsets of {dry, wet}. A product with both supports the customer-facing mode toggle at checkout. Defaults to {dry} so non-inflatable and single-mode products keep current behavior.';
comment on column public.products.wet_upcharge_cents is
  'Sprint 6.0 — flat upcharge added to base_price when customer picks wet at checkout. NULL or 0 means no upcharge. Stored as cents to match base_price convention and avoid float drift.';
comment on column public.products.anchoring_methods is
  'Sprint 6.0 — operator-set list of anchoring methods this unit supports. Surfaced on the crew dispatch sheet as a Bring: line. Pinned to the five industry-standard values via CHECK; widening requires a migration.';
comment on column public.products.required_anchor_count is
  'Sprint 6.0 — from the manufacturer specification. Surfaced on the crew dispatch sheet as Bring: stakes x6. NULL when the operator does not know or has not set it.';

alter table public.products
  drop constraint if exists products_supports_modes_check;
alter table public.products
  add constraint products_supports_modes_check
  check (
    supports_modes <@ '{dry,wet}'::text[]
    and array_length(supports_modes, 1) >= 1
  );

alter table public.products
  drop constraint if exists products_anchoring_methods_check;
alter table public.products
  add constraint products_anchoring_methods_check
  check (
    anchoring_methods <@ '{stakes,sandbags,water_barrels,concrete_weights,tie_downs}'::text[]
  );

alter table public.order_items
  add column if not exists selected_mode text;

comment on column public.order_items.selected_mode is
  'Sprint 6.0 — wet vs dry choice the customer made at checkout for inflatable products. NULL for products without wet/dry support. Surfaced on the crew dispatch sheet next to the item name.';

alter table public.order_items
  drop constraint if exists order_items_selected_mode_check;
alter table public.order_items
  add constraint order_items_selected_mode_check
  check (selected_mode is null or selected_mode in ('dry','wet'));
