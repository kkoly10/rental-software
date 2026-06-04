-- Close a WORM gap from 20260605_020000: row-level BEFORE UPDATE/DELETE
-- triggers do NOT fire on TRUNCATE, so without this a TRUNCATE could wipe the
-- append-only audit log. Add a statement-level BEFORE TRUNCATE trigger reusing
-- the same block function (it only RAISEs, so it is valid at statement level).
-- Verified live: `truncate public.app_event_logs` is now rejected.
drop trigger if exists app_event_logs_no_truncate on public.app_event_logs;
create trigger app_event_logs_no_truncate
  before truncate on public.app_event_logs
  for each statement execute function public.app_event_logs_block_mutation();
