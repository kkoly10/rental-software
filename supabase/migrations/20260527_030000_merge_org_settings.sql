-- Atomic shallow-merge of top-level keys into organizations.settings.
-- Every settings writer previously did read-modify-write (read settings, spread
-- {...existing, ...patch}, write back), so two near-simultaneous saves silently
-- clobbered each other. This RPC applies the patch in a single statement.
--
-- SECURITY DEFINER + an explicit membership check: callers may only patch an
-- org they are an active member of (the function bypasses RLS, so this gate is
-- mandatory).
create or replace function public.merge_org_settings(p_org_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if not exists (
    select 1 from public.organization_memberships
    where organization_id = p_org_id
      and profile_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'not authorized for organization %', p_org_id using errcode = '42501';
  end if;

  update public.organizations
     set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
   where id = p_org_id
     and deleted_at is null
   returning settings into v_settings;

  return v_settings;
end;
$$;

revoke all on function public.merge_org_settings(uuid, jsonb) from public;
revoke all on function public.merge_org_settings(uuid, jsonb) from anon;
grant execute on function public.merge_org_settings(uuid, jsonb) to authenticated;
