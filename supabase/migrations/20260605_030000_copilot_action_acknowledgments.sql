-- One-time, per-operator acknowledgment of the AI Operator Copilot action terms.
-- Recorded the first time an operator confirms a Copilot action (e.g. recording
-- a payment). Stored with a timestamp + IP/user-agent as evidence of consent.

create table if not exists public.copilot_action_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  version         text not null,
  acknowledged_at timestamptz not null default now(),
  ip              text,
  user_agent      text,
  unique (organization_id, profile_id, version)
);

create index if not exists copilot_action_ack_org_profile_idx
  on public.copilot_action_acknowledgments (organization_id, profile_id);

alter table public.copilot_action_acknowledgments enable row level security;

-- An operator can see and create their own acknowledgments within an org they
-- belong to. There is intentionally no UPDATE/DELETE policy — acknowledgments
-- are immutable evidence.
drop policy if exists "copilot_ack_select_own" on public.copilot_action_acknowledgments;
create policy "copilot_ack_select_own"
  on public.copilot_action_acknowledgments
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    and organization_id in (select public.get_user_org_ids())
  );

drop policy if exists "copilot_ack_insert_own" on public.copilot_action_acknowledgments;
create policy "copilot_ack_insert_own"
  on public.copilot_action_acknowledgments
  for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and organization_id in (select public.get_user_org_ids())
  );
