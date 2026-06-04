-- Evolve reserve_availability_if_available to return the newly-created
-- block_id alongside ok=true. This lets the caller reserve the slot
-- BEFORE inserting the order (closing TOCTOU follow-up #2: the orphan
-- order window) and then attach the order_id via a follow-up UPDATE
-- once the row exists.
--
-- The function signature stays the same — adds returned `block_id` to
-- the jsonb. All existing callers ignore extra keys, so this is fully
-- backwards-compatible.

CREATE OR REPLACE FUNCTION public.reserve_availability_if_available(
  p_organization_id  uuid,
  p_product_id       uuid,
  p_block_type       text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_reason           text,
  p_source_order_id  uuid,
  p_expires_at       timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_capacity  integer;
  v_reserved_count  integer;
  v_block_id        uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(
    ('x' || left(md5(p_organization_id::text || ':' || p_product_id::text), 16))::bit(64)::bigint
  );

  SELECT count(*) INTO v_asset_capacity
  FROM public.assets
  WHERE organization_id = p_organization_id
    AND product_id      = p_product_id
    AND operational_status IN ('ready', 'available', 'active');

  IF v_asset_capacity = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This item is not currently available for booking.'
    );
  END IF;

  SELECT count(*) INTO v_reserved_count
  FROM public.availability_blocks
  WHERE organization_id = p_organization_id
    AND product_id      = p_product_id
    AND starts_at       < p_ends_at
    AND ends_at         > p_starts_at
    AND (expires_at IS NULL OR expires_at > now());

  IF v_reserved_count >= v_asset_capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This rental is already reserved for the selected date.'
    );
  END IF;

  INSERT INTO public.availability_blocks (
    organization_id, product_id, block_type,
    starts_at, ends_at, reason, source_order_id, expires_at
  ) VALUES (
    p_organization_id, p_product_id, p_block_type,
    p_starts_at, p_ends_at, p_reason, p_source_order_id, p_expires_at
  )
  RETURNING id INTO v_block_id;

  RETURN jsonb_build_object('ok', true, 'block_id', v_block_id);
END;
$$;
