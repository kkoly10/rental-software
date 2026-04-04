-- Add terms acceptance tracking to profiles and orders tables
-- Profiles: track when operators accept Terms of Service at signup
-- Orders: track when customers accept rental terms at checkout

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_ip inet;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
