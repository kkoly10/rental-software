-- User guidance state for operator support system
-- Tracks welcome modal, tour completion, and dismissed help banners per user

create table if not exists public.user_guidance_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  has_seen_welcome boolean not null default false,
  has_completed_tour boolean not null default false,
  dismissed_help jsonb not null default '{}'::jsonb,
  dismissed_checklist boolean not null default false,
  tour_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: users can only read/update their own guidance state
alter table public.user_guidance_state enable row level security;

create policy "Users can read own guidance state"
  on public.user_guidance_state for select
  using (auth.uid() = profile_id);

create policy "Users can insert own guidance state"
  on public.user_guidance_state for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own guidance state"
  on public.user_guidance_state for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Auto-update updated_at on changes
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_guidance_state_updated_at
  before update on public.user_guidance_state
  for each row execute function public.set_updated_at();
