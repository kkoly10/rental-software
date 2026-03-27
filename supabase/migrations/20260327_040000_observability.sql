create table if not exists public.app_event_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  action text not null,
  status text not null default 'info',
  route text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  message text not null,
  route text null,
  stack text null,
  context jsonb not null default '{}'::jsonb
);

alter table public.app_event_logs enable row level security;
alter table public.app_error_logs enable row level security;

revoke all on public.app_event_logs from anon, authenticated;
revoke all on public.app_error_logs from anon, authenticated;

create index if not exists idx_app_event_logs_created_at on public.app_event_logs(created_at desc);
create index if not exists idx_app_event_logs_source on public.app_event_logs(source, created_at desc);
create index if not exists idx_app_error_logs_created_at on public.app_error_logs(created_at desc);
create index if not exists idx_app_error_logs_source on public.app_error_logs(source, created_at desc);
