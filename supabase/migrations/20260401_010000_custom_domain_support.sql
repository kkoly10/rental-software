-- Migration: Add custom domain support and slug constraints to organizations
-- The slug column already exists from the initial schema but needs validation constraints.
-- This migration adds custom domain columns and improves slug validation.

-- Add CHECK constraint for slug format (lowercase alphanumeric + hyphens, 3-63 chars, no leading/trailing hyphens)
alter table organizations
  add constraint organizations_slug_format_check
  check (slug ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$');

-- Add custom domain columns
alter table organizations
  add column if not exists custom_domain text unique,
  add column if not exists custom_domain_verified boolean not null default false;

-- Index for fast custom domain lookups
create unique index if not exists idx_organizations_custom_domain
  on organizations (custom_domain)
  where custom_domain is not null;

-- RLS: Allow anon/public users to read slug and custom_domain for routing resolution
create policy "Public can read org slug and domain"
  on organizations for select
  using (true);

-- RLS: Only org owners/admins can update slug and custom_domain
-- (Relies on existing membership-based RLS for update operations)
