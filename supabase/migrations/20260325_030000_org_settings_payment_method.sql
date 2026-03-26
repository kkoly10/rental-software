-- Add settings JSONB column to organizations for website configuration.
-- Add support_email and phone columns to organizations for editable business profile.
-- Add payment_method and reference_note columns to payments for manual payment recording.

alter table organizations add column if not exists settings jsonb not null default '{}'::jsonb;
alter table organizations add column if not exists support_email text;
alter table organizations add column if not exists phone text;

alter table payments add column if not exists payment_method text;
alter table payments add column if not exists reference_note text;
