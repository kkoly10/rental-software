-- Quantity-aware availability + maintenance-aware reserve.
--
-- Two correctness gaps closed here (Operator Wave 1, P0):
--
--   1. OVERSELLING bulk inventory. The previous reserve counted one
--      availability_block ROW per reservation regardless of how many
--      units it consumed. An operator who rents chairs by the unit
--      ("200 chairs" = one order line) only ever produced one block,
--      so capacity was effectively "1 booking at a time" — or, if they
--      had no asset rows, zero. Conversely a serialized product with
--      5 asset rows could be booked 5 times even if each booking took
--      the whole pool. We now track a per-block `quantity` and a
--      per-product `quantity_on_hand`, and the reserve checks
--      SUM(quantity) + requested <= capacity.
--
--   2. MAINTENANCE holds were honored by the JS display path
--      (lib/availability/check.ts subtracts assets with an open/
--      in_progress maintenance_record) but NOT by the atomic reserve
--      RPC — so the authoritative check-and-insert ignored downtime and
--      could reserve an asset that was out of service. The capacity math
--      below now excludes maintenance-held assets in SQL, so the display
--      path and the reserve agree.
--
-- Capacity model:
--   capacity = COALESCE(
--     products.quantity_on_hand,           -- bulk/pooled count when set
--     bookable_asset_rows - maintenance_held_asset_rows  -- serialized
--   )
-- A NULL quantity_on_hand keeps the historical asset-row behavior, so
-- existing serialized products (tents, bounce houses) are unchanged.

-- 1. Per-product pooled inventory count. NULL = "derive from asset rows"
--    (unchanged behavior). A number = "we own N of this", used directly
--    as capacity for bulk items that aren't tracked as individual assets.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity_on_hand integer
    CHECK (quantity_on_hand IS NULL OR quantity_on_hand >= 0);

COMMENT ON COLUMN public.products.quantity_on_hand IS
  'Pooled inventory count for bulk/per-unit products (e.g. 500 chairs). '
  'NULL means capacity is derived from bookable asset rows instead.';

-- 2. Per-block unit count. Defaults to 1 so every existing block (and
--    every serialized single-unit reservation) keeps counting as one.
ALTER TABLE public.availability_blocks
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1
    CHECK (quantity >= 1);

COMMENT ON COLUMN public.availability_blocks.quantity IS
  'Units consumed by this reservation. 1 for serialized single-unit '
  'rentals; the ordered unit count for per-unit/bulk products.';

-- 3. Replace the reserve function: quantity-aware + maintenance-aware.
DROP FUNCTION IF EXISTS public.reserve_availability_if_available(
  uuid, uuid, text, timestamptz, timestamptz, text, uuid, timestamptz
);

CREATE OR REPLACE FUNCTION public.reserve_availability_if_available(
  p_organization_id  uuid,
  p_product_id       uuid,
  p_block_type       text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_reason           text,
  p_source_order_id  uuid,
  p_expires_at       timestamptz DEFAULT NULL,
  p_quantity         integer     DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity_on_hand integer;
  v_capacity         integer;
  v_reserved         integer;
  v_qty              integer := GREATEST(COALESCE(p_quantity, 1), 1);
BEGIN
  -- Advisory lock: hash the two UUIDs into a stable bigint.
  -- Serializes all concurrent reserve attempts for the same org+product.
  PERFORM pg_advisory_xact_lock(
    ('x' || left(md5(p_organization_id::text || ':' || p_product_id::text), 16))::bit(64)::bigint
  );

  -- Pooled inventory count, if the operator set one for this product.
  SELECT quantity_on_hand INTO v_quantity_on_hand
  FROM public.products
  WHERE id = p_product_id
    AND organization_id = p_organization_id;

  IF v_quantity_on_hand IS NOT NULL THEN
    -- Bulk/pooled product: capacity is the declared count directly.
    v_capacity := v_quantity_on_hand;
  ELSE
    -- Serialized product: capacity is the number of bookable asset rows
    -- MINUS any currently held by an open/in_progress maintenance record
    -- (matches the JS display path in lib/availability/check.ts so the
    -- two never disagree).
    SELECT count(*) INTO v_capacity
    FROM public.assets a
    WHERE a.organization_id = p_organization_id
      AND a.product_id      = p_product_id
      AND a.deleted_at IS NULL
      AND a.operational_status IN ('ready', 'available', 'active')
      AND NOT EXISTS (
        SELECT 1
        FROM public.maintenance_records m
        WHERE m.asset_id = a.id
          AND m.organization_id = p_organization_id
          AND m.status IN ('open', 'in_progress')
      );
  END IF;

  IF v_capacity IS NULL OR v_capacity = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This item is not currently available for booking.'
    );
  END IF;

  -- Sum the units consumed by overlapping non-expired blocks.
  SELECT COALESCE(sum(quantity), 0) INTO v_reserved
  FROM public.availability_blocks
  WHERE organization_id = p_organization_id
    AND product_id      = p_product_id
    AND starts_at       < p_ends_at
    AND ends_at         > p_starts_at
    AND (expires_at IS NULL OR expires_at > now());

  IF v_reserved + v_qty > v_capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This rental is already reserved for the selected date.'
    );
  END IF;

  -- Safe to insert — still inside the advisory lock
  INSERT INTO public.availability_blocks (
    organization_id, product_id, block_type,
    starts_at, ends_at, reason, source_order_id, expires_at, quantity
  ) VALUES (
    p_organization_id, p_product_id, p_block_type,
    p_starts_at, p_ends_at, p_reason, p_source_order_id, p_expires_at, v_qty
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_availability_if_available(
  uuid, uuid, text, timestamptz, timestamptz, text, uuid, timestamptz, integer
) TO authenticated, service_role;
