create table if not exists public.rate_limit_windows (
  scope text not null,
  actor_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, actor_key, window_start)
);

alter table public.rate_limit_windows enable row level security;

create or replace function public.set_row_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rate_limit_windows_updated_at
  before update on public.rate_limit_windows
  for each row execute function public.set_row_updated_at();

create or replace function public.apply_rate_limit(
  p_scope text,
  p_actor_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_request_count integer;
begin
  if p_limit <= 0 then
    raise exception 'p_limit must be greater than zero';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than zero';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_windows as rl (
    scope,
    actor_key,
    window_start,
    request_count
  )
  values (
    p_scope,
    p_actor_key,
    v_window_start,
    1
  )
  on conflict (scope, actor_key, window_start)
  do update set
    request_count = rl.request_count + 1,
    updated_at = now()
  returning rl.request_count into v_request_count;

  return query
  select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    greatest(ceil(extract(epoch from (v_window_end - now())))::integer, 0);
end;
$$;

revoke all on public.rate_limit_windows from anon, authenticated;
revoke all on function public.apply_rate_limit(text, text, integer, integer) from anon, authenticated;
