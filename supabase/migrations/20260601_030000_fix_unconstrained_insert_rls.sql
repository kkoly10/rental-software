-- security: scope notifications and communication_log INSERT policies
-- to the caller's org. The previous policies had with_check = true,
-- allowing any logged-in user (and in the notifications case, also anon
-- via the public role) to insert rows for any org.
--
-- Call sites confirmed server-side only:
--   notifications:        lib/data/notifications.ts:149
--                         (callers: stripe webhook = service-role bypass;
--                          portal sign-document = service-role admin
--                          client after 20260601_010000)
--   communication_log:    lib/communications/log.ts:26
--                         (caller: lib/messages/actions.ts:146 =
--                          authenticated user-context server action,
--                          email/system triggers = service-role bypass)
--
-- Service-role bypasses RLS, so the only path constrained by these
-- policies is authenticated user-context server actions — which must
-- always specify the caller's own organization_id.

drop policy if exists "Allow notification inserts" on public.notifications;
create policy "Org members can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (organization_id in (select get_user_org_ids()));

drop policy if exists "Authenticated can insert communication_log"
  on public.communication_log;
create policy "Org members can insert communication_log"
  on public.communication_log
  for insert
  to authenticated
  with check (organization_id in (select get_user_org_ids()));
