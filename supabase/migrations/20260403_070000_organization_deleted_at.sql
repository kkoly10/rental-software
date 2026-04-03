-- Add soft-delete support for organizations (account deletion)
alter table public.organizations add column if not exists deleted_at timestamptz;
