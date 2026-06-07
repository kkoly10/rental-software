-- Phase 4g — atomic set_primary_vertical RPC.
--
-- The partial unique index organization_verticals_one_primary
-- enforces "at most one primary per org", so flipping is_primary
-- across two rows from the app would require an atomic transaction.
-- This RPC bundles the clear + set into a single statement so the
-- index never sees an intermediate state with zero or two primaries.
--
-- SECURITY DEFINER + an explicit ownership check so the RPC behaves
-- exactly like the RLS-driven app actions: only org owners can
-- promote a vertical. The RPC raises a friendly exception on
-- non-ownership which the action catches and rewrites into the same
-- "Only org owners…" message used by add/remove.
--
-- Idempotent: setting the current primary to itself is a no-op.

create or replace function public.set_primary_vertical(
  p_vertical_slug text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ownership lookup matches the policy on organization_verticals so
  -- a member without owner role gets a clean 403, not a silent miss.
  select organization_id into v_org_id
  from organization_memberships
  where profile_id = v_user_id
    and role       = 'owner'
    and status     = 'active'
  limit 1;

  if v_org_id is null then
    raise exception 'Only org owners can change the primary vertical';
  end if;

  -- The target row must already exist — promoting a vertical the org
  -- doesn't declare would create a phantom primary.
  perform 1
  from organization_verticals
  where organization_id = v_org_id
    and vertical_slug   = p_vertical_slug;
  if not found then
    raise exception 'Vertical % is not declared for this org', p_vertical_slug;
  end if;

  -- Clear-then-set inside one statement-set so the partial unique
  -- index never sees two primaries. Postgres validates uniqueness
  -- per-statement (not per-row) here because both UPDATEs in the
  -- same function share the same snapshot.
  update organization_verticals
     set is_primary = false
   where organization_id = v_org_id
     and is_primary      = true
     and vertical_slug   <> p_vertical_slug;

  update organization_verticals
     set is_primary = true
   where organization_id = v_org_id
     and vertical_slug   = p_vertical_slug
     and is_primary      = false;
end;
$$;
