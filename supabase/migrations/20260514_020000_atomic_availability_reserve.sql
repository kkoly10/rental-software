-- Atomic availability check + reserve function.
--
-- Eliminates the TOCTOU race between checking capacity and inserting a block.
-- Uses pg_advisory_xact_lock keyed on (organization_id, product_id) so concurrent
-- requests for the same item on the same org are serialized for the duration of
-- the transaction. Requests for different items or orgs run in parallel.

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
BEGIN
  -- Advisory lock: hash the two UUIDs into a stable bigint.
  -- Serializes all concurrent reserve attempts for the same org+product.
  PERFORM pg_advisory_xact_lock(
    ('x' || left(md5(p_organization_id::text || ':' || p_product_id::text), 16))::bit(64)::bigint
  );

  -- Count physical assets available for booking
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

  -- Count overlapping non-expired blocks
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

  -- Safe to insert — still inside the advisory lock
  INSERT INTO public.availability_blocks (
    organization_id, product_id, block_type,
    starts_at, ends_at, reason, source_order_id, expires_at
  ) VALUES (
    p_organization_id, p_product_id, p_block_type,
    p_starts_at, p_ends_at, p_reason, p_source_order_id, p_expires_at
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_availability_if_available(
  uuid, uuid, text, timestamptz, timestamptz, text, uuid, timestamptz
) TO authenticated, service_role;
