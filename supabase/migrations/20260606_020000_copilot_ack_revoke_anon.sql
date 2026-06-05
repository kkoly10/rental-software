-- Security hygiene: revoke the default table grants from the public/anon roles
-- on copilot_action_acknowledgments.
--
-- New tables in the public schema inherit ALTER DEFAULT PRIVILEGES grants that
-- expose them to the `anon` (unauthenticated) role. RLS already denies anon any
-- rows (there is no anon policy — see 20260605_030000), so this is not a data
-- leak, but the table-level grant makes it visible in the GraphQL schema and
-- trips the "anon can SELECT" advisor. This acknowledgment ledger is only ever
-- read/written by authenticated operators, so anon needs no access at all.
--
-- The `authenticated` role keeps its grants; its own-row RLS policies
-- (copilot_ack_select_own / copilot_ack_insert_own) continue to scope access.

revoke all on public.copilot_action_acknowledgments from anon;
revoke all on public.copilot_action_acknowledgments from public;
