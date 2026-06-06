-- Phase 1d — order_items tracking for add-ons + variant selection.
--
-- parent_order_item_id : self-FK so an add-on line item can point to
--                        its parent. A tent + 2 sidewalls + lighting
--                        becomes 4 order_items rows: the tent row
--                        with parent_order_item_id = null, plus 3
--                        rows whose parent points at the tent.
--                        Refund/display walks the tree.
-- selected_variant_id  : the customer's variant pick (backdrop, color,
--                        surface) — points at product_variants.
--
-- Both nullable + non-cascading on the variant FK so deleting a
-- variant doesn't blow away historical orders. Cascading on parent
-- because if you delete a parent line item mid-order the add-ons
-- become orphans.
--
-- Capability registrations:
--   lib/capabilities/composition/add-ons.ts
--   lib/capabilities/display/variant-gallery.ts

alter table public.order_items
  add column if not exists parent_order_item_id uuid
    references public.order_items(id) on delete cascade,
  add column if not exists selected_variant_id uuid
    references public.product_variants(id) on delete set null;

create index if not exists order_items_parent_idx
  on public.order_items (parent_order_item_id);

create index if not exists order_items_selected_variant_idx
  on public.order_items (selected_variant_id)
  where selected_variant_id is not null;
