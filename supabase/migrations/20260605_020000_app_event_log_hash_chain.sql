-- Make app_event_logs a tamper-EVIDENT, append-only (WORM) audit log.
--
-- Context: app_event_logs is the audit trail for sensitive operations
-- (manual payments, Copilot actions, etc.). RLS already revokes all access
-- from anon/authenticated, so only the service role writes it. This migration
-- adds two further protections sought for legal defensibility:
--   1. A SHA-256 hash chain: each row's hash covers the previous row's hash, so
--      any after-the-fact edit/insert/delete is detectable (the chain breaks).
--   2. WORM enforcement: UPDATE and DELETE are blocked outright (append-only),
--      even for the service role, via triggers.
--
-- app_event_logs is INSERT-only in the codebase today (verified), so blocking
-- UPDATE/DELETE breaks no existing flow. pgcrypto (digest) is already enabled.
--
-- The chain is GLOBAL (single sequence) for simple linear verification; audit
-- volume for this product is low, so serializing appends is negligible.

-- 1. Chain columns + a monotonic ordering sequence. Existing rows predate the
--    chain and keep NULLs; the chain starts at the first insert after this runs.
create sequence if not exists public.app_event_logs_seq;

alter table public.app_event_logs
  add column if not exists entry_seq  bigint,
  add column if not exists prev_hash  text,
  add column if not exists entry_hash text;

-- 2. BEFORE INSERT: assign sequence, link to the previous row, compute hash.
create or replace function public.app_event_logs_chain()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_prev    text;
  v_payload text;
begin
  -- Serialize all chain appends so concurrent inserts can't fork the chain.
  perform pg_advisory_xact_lock(4915012025060502);

  new.entry_seq := nextval('public.app_event_logs_seq');

  select entry_hash
    into v_prev
    from public.app_event_logs
   where entry_seq is not null
   order by entry_seq desc
   limit 1;

  new.prev_hash := v_prev; -- NULL for the very first chained row

  v_payload :=
    coalesce(v_prev, '')                        || '|' ||
    new.entry_seq::text                         || '|' ||
    coalesce(new.organization_id::text, '')     || '|' ||
    coalesce(new.user_id::text, '')             || '|' ||
    coalesce(new.source, '')                    || '|' ||
    coalesce(new.action, '')                    || '|' ||
    coalesce(new.status, '')                    || '|' ||
    coalesce(new.route, '')                      || '|' ||
    coalesce(new.metadata::text, '')            || '|' ||
    coalesce(new.created_at::text, now()::text);

  new.entry_hash := encode(digest(convert_to(v_payload, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists app_event_logs_chain_biu on public.app_event_logs;
create trigger app_event_logs_chain_biu
  before insert on public.app_event_logs
  for each row execute function public.app_event_logs_chain();

-- 3. WORM: block UPDATE and DELETE (append-only), even for the service role.
create or replace function public.app_event_logs_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'app_event_logs is append-only (WORM); % is not permitted', tg_op;
end;
$$;

drop trigger if exists app_event_logs_no_update on public.app_event_logs;
create trigger app_event_logs_no_update
  before update on public.app_event_logs
  for each row execute function public.app_event_logs_block_mutation();

drop trigger if exists app_event_logs_no_delete on public.app_event_logs;
create trigger app_event_logs_no_delete
  before delete on public.app_event_logs
  for each row execute function public.app_event_logs_block_mutation();

-- 4. Verification: walk the chain in order and return the first row whose link
--    or recomputed hash doesn't match. No rows returned == chain intact.
create or replace function public.verify_app_event_log_chain()
returns table (broken_seq bigint, reason text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r           record;
  v_prev      text := null;
  v_payload   text;
  v_recomputed text;
begin
  for r in
    select * from public.app_event_logs
     where entry_seq is not null
     order by entry_seq asc
  loop
    if r.prev_hash is distinct from v_prev then
      broken_seq := r.entry_seq;
      reason := 'prev_hash does not match the previous row''s entry_hash';
      return next;
      return;
    end if;

    v_payload :=
      coalesce(r.prev_hash, '')                || '|' ||
      r.entry_seq::text                        || '|' ||
      coalesce(r.organization_id::text, '')    || '|' ||
      coalesce(r.user_id::text, '')            || '|' ||
      coalesce(r.source, '')                   || '|' ||
      coalesce(r.action, '')                   || '|' ||
      coalesce(r.status, '')                   || '|' ||
      coalesce(r.route, '')                     || '|' ||
      coalesce(r.metadata::text, '')           || '|' ||
      coalesce(r.created_at::text, '');

    v_recomputed := encode(digest(convert_to(v_payload, 'UTF8'), 'sha256'), 'hex');

    if v_recomputed is distinct from r.entry_hash then
      broken_seq := r.entry_seq;
      reason := 'entry_hash does not match recomputed hash (row was altered)';
      return next;
      return;
    end if;

    v_prev := r.entry_hash;
  end loop;
end;
$$;
