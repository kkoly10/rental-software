-- Sprint 4 — extend communication_log.channel to include 'whatsapp'.
--
-- The original communication_log table was created in
-- 20260403_050000_communication_log.sql with a CHECK constraint
-- restricting channel to ('email', 'sms', 'portal_message', 'system').
-- Sprint 4 adds WhatsApp as a first-class channel so the operator's
-- comm log surfaces a "WhatsApp" badge when a notification went
-- through that path instead of SMS.
--
-- Drop-and-recreate is the cleanest Postgres pattern for extending a
-- CHECK constraint — there's no ALTER CONSTRAINT clause to widen an
-- existing list.

alter table communication_log
  drop constraint if exists communication_log_channel_check;

alter table communication_log
  add constraint communication_log_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'portal_message', 'system'));
