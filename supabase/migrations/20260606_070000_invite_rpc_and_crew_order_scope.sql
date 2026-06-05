-- Recon follow-up: two 10/10 fixes.
--
-- P1 — Team-invite acceptance was broken: a not-yet-member invitee cannot read
--   or claim their invite under team_invites' membership-scoped RLS, so
--   lib/team/accept-invite.ts always failed at the first SELECT (no one could
--   ever join an org). Fixed with a SECURITY DEFINER RPC that does the whole
--   accept atomically and is the only authorized path — it never trusts a
--   caller-supplied role.
--
-- P2 — Crew could write any order in their org directly (the orders write RLS
--   included 'crew' because the delivered-flip ran via the user client). Move
--   that flip into the already-assignment-checked crew_update_stop_status() RPC
--   and drop 'crew' from the orders write policy, so crew have zero unscoped
--   order writes.

-- ── P1: accept_team_invite ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token text)
RETURNS TABLE (
  ok                boolean,
  reason            text,
  organization_id   uuid,
  organization_name text,
  role              text,
  invited_email     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_email   text;
  v_invite  record;
  v_orgname text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Lock the invite row to serialize concurrent accepts (no half-accepted state).
  -- Column refs are alias-qualified because the RETURNS TABLE OUT params
  -- (organization_id, role, invited_email, …) shadow the table column names.
  SELECT t.id, t.organization_id, t.invited_email, t.role, t.status, t.expires_at
    INTO v_invite
    FROM public.team_invites t
   WHERE t.token = p_token
   FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN QUERY SELECT false, ('already_' || v_invite.status)::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN QUERY SELECT false, 'expired'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Authorize against the verified session email, not anything client-supplied.
  IF v_email IS NULL OR lower(v_email) <> lower(v_invite.invited_email) THEN
    RETURN QUERY SELECT false, 'email_mismatch'::text, NULL::uuid, NULL::text, NULL::text, v_invite.invited_email;
    RETURN;
  END IF;

  -- Defense against a corrupted/hand-written invite row carrying a bogus role.
  IF v_invite.role NOT IN ('owner','admin','dispatcher','crew','viewer') THEN
    RETURN QUERY SELECT false, 'invalid_role'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT name INTO v_orgname FROM public.organizations
   WHERE id = v_invite.organization_id AND deleted_at IS NULL;

  IF EXISTS (
    SELECT 1 FROM public.organization_memberships om
     WHERE om.organization_id = v_invite.organization_id
       AND om.profile_id = v_uid
       AND om.status = 'active'
  ) THEN
    -- Idempotent: still retire the invite, but report they were already in.
    UPDATE public.team_invites SET status = 'accepted', accepted_at = now() WHERE id = v_invite.id;
    RETURN QUERY SELECT false, 'already_member'::text, v_invite.organization_id, v_orgname, v_invite.role, v_invite.invited_email;
    RETURN;
  END IF;

  -- Create the membership with the role AS STORED on the invite (owner/admin set
  -- it when sending; the invitee can never influence it).
  INSERT INTO public.organization_memberships (organization_id, profile_id, role, status)
  VALUES (v_invite.organization_id, v_uid, v_invite.role, 'active');

  UPDATE public.team_invites SET status = 'accepted', accepted_at = now() WHERE id = v_invite.id;

  RETURN QUERY SELECT true, NULL::text, v_invite.organization_id, v_orgname, v_invite.role, v_invite.invited_email;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;

COMMENT ON FUNCTION public.accept_team_invite(text) IS
  'Atomic team-invite acceptance for a not-yet-member invitee: validates pending/unexpired/email-match against the verified session, creates the membership with the invite-stored role, and marks the invite accepted — all under a row lock. Only authorized accept path.';

-- ── P2a: fold the delivered-flip into the crew RPC ──────────────────────────
-- Return signature gains flipped_to_delivered, so drop + recreate.
DROP FUNCTION IF EXISTS public.crew_update_stop_status(uuid, uuid, uuid, text);

CREATE FUNCTION public.crew_update_stop_status(
  p_stop_id    uuid,
  p_org_id     uuid,
  p_user_id    uuid,
  p_new_status text
) RETURNS TABLE (
  ok                   boolean,
  reason               text,
  route_id             uuid,
  order_id             uuid,
  stop_type            text,
  prev_status          text,
  flipped_to_delivered boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role    text;
  v_route   record;
  v_updated record;
  v_flipped boolean := false;
BEGIN
  SELECT role INTO v_role
    FROM public.organization_memberships
   WHERE organization_id = p_org_id
     AND profile_id      = p_user_id
     AND status          = 'active'
   LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner','admin','dispatcher','crew') THEN
    RETURN QUERY SELECT false, 'not_authorized'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT s.route_id, s.order_id, s.stop_type, s.stop_status AS prev_status,
         r.organization_id, r.assigned_driver_profile_id
    INTO v_route
    FROM public.route_stops s
    JOIN public.routes r ON r.id = s.route_id
   WHERE s.id = p_stop_id
   FOR UPDATE OF r;

  IF v_route IS NULL OR v_route.organization_id <> p_org_id THEN
    RETURN QUERY SELECT false, 'not_found'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  IF v_role = 'crew' AND v_route.assigned_driver_profile_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT false, 'not_assigned'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  UPDATE public.route_stops s
     SET stop_status  = p_new_status,
         completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE s.completed_at END
   WHERE s.id = p_stop_id
  RETURNING s.route_id, s.order_id, s.stop_type, s.stop_status INTO v_updated;

  -- Sync the parent order to 'delivered' when a delivery stop is completed.
  -- Same guard as the former app-side flip; runs here so crew need no direct
  -- write access to `orders`.
  IF p_new_status = 'completed'
     AND v_updated.stop_type = 'delivery'
     AND v_updated.order_id IS NOT NULL THEN
    UPDATE public.orders
       SET order_status = 'delivered'
     WHERE id = v_updated.order_id
       AND organization_id = p_org_id
       AND deleted_at IS NULL
       AND order_status IN ('confirmed','scheduled','out_for_delivery');
    IF FOUND THEN
      v_flipped := true;
    END IF;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_updated.route_id, v_updated.order_id,
                      v_updated.stop_type, v_route.prev_status, v_flipped;
END;
$$;

REVOKE ALL ON FUNCTION public.crew_update_stop_status(uuid, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.crew_update_stop_status(uuid, uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.crew_update_stop_status(uuid, uuid, uuid, text) IS
  'Atomic assignment-check + stop status update, and (for a completed delivery stop) the parent order''s flip to delivered. Lets crew be removed from the orders write RLS while keeping the flip working.';

-- ── P2b: drop crew from the orders write policies ───────────────────────────
DROP POLICY IF EXISTS "Operators can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Operators can update orders" ON public.orders;
DROP POLICY IF EXISTS "Operators can delete orders" ON public.orders;

CREATE POLICY "Operators can insert orders" ON public.orders
  FOR INSERT TO public
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );

CREATE POLICY "Operators can update orders" ON public.orders
  FOR UPDATE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );

CREATE POLICY "Operators can delete orders" ON public.orders
  FOR DELETE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );
