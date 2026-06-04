-- Harden the audit-chain functions surfaced by the Supabase security advisor
-- after 20260605_020000: the SECURITY DEFINER functions must not be invokable
-- by anon/authenticated via PostgREST RPC, and every function should pin its
-- search_path. Revoking EXECUTE does NOT stop the trigger functions from firing
-- (Postgres doesn't check EXECUTE privilege when a trigger fires), so audit
-- logging is unaffected — verified with an insert self-test post-revoke.
alter function public.app_event_logs_block_mutation() set search_path = '';

revoke all on function public.app_event_logs_chain()          from public, anon, authenticated;
revoke all on function public.app_event_logs_block_mutation()  from public, anon, authenticated;
revoke all on function public.verify_app_event_log_chain()    from public, anon, authenticated;
