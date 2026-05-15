-- Atomic setup progress flag update to prevent lost updates.
--
-- The JS-level markSetupStep() used a read-modify-write on organizations.settings
-- (read → merge in memory → write back). Concurrent calls from different server
-- actions (product creation + service area creation at the same time) caused
-- the second write to overwrite the first, losing a setup flag.
--
-- This function uses jsonb_set() inside a single UPDATE statement so the merge
-- happens atomically inside Postgres — no lost-update race is possible.

create or replace function mark_org_setup_step(p_org_id uuid, p_step text)
returns void
language sql
security definer
set search_path = public
as $$
  update organizations
  set settings = jsonb_set(
    jsonb_set(
      coalesce(settings::jsonb, '{}'),
      '{setup_progress}',
      coalesce((settings::jsonb -> 'setup_progress'), '{}')
    ),
    array['setup_progress', p_step],
    'true'::jsonb
  )
  where id = p_org_id;
$$;
