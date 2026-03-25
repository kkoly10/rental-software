-- ============================================================
-- Organization Settings + Schema Enhancements
-- ============================================================
-- Adds a settings JSONB column to organizations for business
-- profile, booking defaults, and website configuration.
-- Also adds payment_method and reference columns to payments.
-- ============================================================

-- Add settings to organizations for business profile/website config
alter table organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Add support_email and phone to organizations directly
alter table organizations
  add column if not exists support_email text,
  add column if not exists phone text;

-- Add payment_method and reference to payments for manual recording
alter table payments
  add column if not exists payment_method text,
  add column if not exists reference_note text;
