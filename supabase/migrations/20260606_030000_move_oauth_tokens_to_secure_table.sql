-- Security hardening: move OAuth credentials off `organizations`.
--
-- The QuickBooks/Xero access+refresh tokens lived as columns on
-- `organizations`, whose RLS SELECT/UPDATE policies are org-scoped but
-- role-blind — so ANY active member (including viewer/crew) could read or
-- overwrite another tenant-mate's accounting OAuth tokens via a direct API
-- call, bypassing the owner/admin app-layer gate.
--
-- Fix: relocate just the credential columns into a dedicated table that is
-- service-role-only (RLS enabled, no policies, grants revoked from
-- anon/authenticated — same lockdown as app_event_logs). The server reads and
-- writes them exclusively via the admin client inside the server-only
-- `lib/integrations/*/connection.ts` modules. Non-secret connection status
-- (realm/tenant id, connected_at, last_sync_*) stays on `organizations` so the
-- dashboard status UI keeps working with the member's own client.

create table if not exists public.organization_oauth_credentials (
  organization_id      uuid primary key references public.organizations(id) on delete cascade,
  qbo_access_token     text,
  qbo_refresh_token    text,
  qbo_token_expires_at timestamptz,
  xero_access_token    text,
  xero_refresh_token   text,
  xero_token_expires_at timestamptz,
  updated_at           timestamptz not null default now()
);

-- Backfill any existing tokens before dropping the source columns. (Verified 0
-- live connections on prod at migration time, but this keeps the migration
-- correct if run against an environment that does have connections.)
insert into public.organization_oauth_credentials (
  organization_id,
  qbo_access_token, qbo_refresh_token, qbo_token_expires_at,
  xero_access_token, xero_refresh_token, xero_token_expires_at
)
select
  id,
  qbo_access_token, qbo_refresh_token, qbo_token_expires_at,
  xero_access_token, xero_refresh_token, xero_token_expires_at
from public.organizations
where qbo_access_token is not null or xero_access_token is not null
on conflict (organization_id) do nothing;

-- Lock the new table to the service role only: RLS on with no policies, and
-- revoke the default grants Supabase hands anon/authenticated on new tables.
alter table public.organization_oauth_credentials enable row level security;
revoke all on public.organization_oauth_credentials from anon;
revoke all on public.organization_oauth_credentials from authenticated;
revoke all on public.organization_oauth_credentials from public;

-- Drop the now-relocated credential columns from organizations. Status columns
-- (qbo_realm_id, qbo_connected_at, qbo_last_sync_at, qbo_last_sync_error and the
-- xero_* equivalents) intentionally remain.
alter table public.organizations
  drop column if exists qbo_access_token,
  drop column if exists qbo_refresh_token,
  drop column if exists qbo_token_expires_at,
  drop column if exists xero_access_token,
  drop column if exists xero_refresh_token,
  drop column if exists xero_token_expires_at;
