-- Sprint 4.5 follow-up — align messages.channel with the channels we
-- actually send on.
--
-- The communication_log table got 'whatsapp' added in
-- 20260603_080000_communication_log_whatsapp.sql when Sprint 4 wired
-- the WhatsApp Business path. The sibling messages table was not
-- touched and still has the original 2026-04 constraint of
--   ('portal', 'dashboard', 'email', 'sms')
--
-- No current write path inserts 'whatsapp' into messages — outbound
-- WhatsApp lands in communication_log only — so this hasn't crashed
-- production. But the constraint is a latent landmine: if a future
-- operator-reply-on-WhatsApp flow writes the conversation row into
-- messages (the natural place), the insert will fail with a CHECK
-- constraint violation and the operator won't see their reply land.
--
-- Drop-and-recreate is the cleanest Postgres pattern for widening a
-- CHECK list, identical to how 20260603_080000 widened
-- communication_log's constraint.

alter table public.messages
  drop constraint if exists messages_channel_check;

alter table public.messages
  add constraint messages_channel_check
  check (channel in ('portal', 'dashboard', 'email', 'sms', 'whatsapp'));
