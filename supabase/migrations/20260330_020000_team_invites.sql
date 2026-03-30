-- Team invites table for pending invitations
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_email text not null,
  role text not null default 'viewer',
  invited_by_profile_id uuid not null references profiles(id),
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invites_token on team_invites (token) where status = 'pending';
create index if not exists idx_team_invites_org on team_invites (organization_id);

-- RLS policies for team_invites
alter table team_invites enable row level security;

create policy "Org members can view invites"
  on team_invites for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Org owners/admins can manage invites"
  on team_invites for all
  using (organization_id in (select public.get_user_org_ids()));

-- Add updated_at to organization_memberships if missing
alter table organization_memberships
  add column if not exists updated_at timestamptz not null default now();
