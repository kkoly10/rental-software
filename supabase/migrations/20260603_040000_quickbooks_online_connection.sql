-- Sprint 2 — QuickBooks Online OAuth + connection state
--
-- Stores the per-org OAuth credentials needed to push paid invoices
-- into QuickBooks Online. Tokens land on the `organizations` table
-- (one connection per org) so the rest of the codebase can find them
-- alongside other operator settings.
--
-- Security notes:
--   - The access + refresh tokens are stored in plain text here. They
--     should be encrypted at rest via Supabase Vault or pgcrypto when
--     we wire that infrastructure (tracked in
--     docs/architecture/quickbooks-online-sync.md as a Sprint 2.5 follow-up).
--   - Tokens are restricted to dispatcher+ by the application layer
--     (lib/integrations/quickbooks/connect.ts); RLS on `organizations`
--     already scopes reads to members, so token leakage requires both
--     org membership AND a bug in the read path.
--
-- The columns are nullable because most orgs won't have connected
-- QuickBooks at any given moment, and we don't want to force a
-- backfill at migration time.

alter table organizations
  add column if not exists qbo_realm_id text,
  add column if not exists qbo_access_token text,
  add column if not exists qbo_refresh_token text,
  add column if not exists qbo_token_expires_at timestamptz,
  add column if not exists qbo_connected_at timestamptz,
  add column if not exists qbo_last_sync_at timestamptz,
  add column if not exists qbo_last_sync_error text;

create index if not exists idx_organizations_qbo_realm_id
  on organizations(qbo_realm_id)
  where qbo_realm_id is not null;

comment on column organizations.qbo_realm_id is
  'Intuit "company" identifier (realmId in the OAuth response). Set on connect, cleared on disconnect.';
comment on column organizations.qbo_access_token is
  'Short-lived (1h) QBO access token. Plain-text for the MVP; should move to Supabase Vault before any meaningful traffic. See docs/architecture/quickbooks-online-sync.md.';
comment on column organizations.qbo_refresh_token is
  'Long-lived (100d) QBO refresh token. Same encryption caveat as access token.';
comment on column organizations.qbo_token_expires_at is
  'When the access token stops being valid. Refresh is triggered when current time is within 60s of this.';
comment on column organizations.qbo_connected_at is
  'When the operator first authorized the connection. Surfaced in the Settings → Integrations card.';
comment on column organizations.qbo_last_sync_at is
  'Timestamp of the most recent successful sync. NULL if never synced.';
comment on column organizations.qbo_last_sync_error is
  'Last sync failure reason (short string). Surfaced in the Settings → Integrations card so operators know something is wrong before tax season.';

-- Per-invoice sync log so a re-sync (manual or via cron) can be idempotent.
-- Tracks the mapping between Korent invoices and QBO Invoice / Payment ids
-- and records the last sync attempt + outcome.
create table if not exists quickbooks_invoice_sync (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  qbo_invoice_id text,
  qbo_payment_id text,
  qbo_customer_id text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed', 'stale')),
  last_attempted_at timestamptz not null default now(),
  last_succeeded_at timestamptz,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create index if not exists idx_qbo_invoice_sync_status
  on quickbooks_invoice_sync(organization_id, sync_status);
create index if not exists idx_qbo_invoice_sync_order
  on quickbooks_invoice_sync(order_id);

comment on table quickbooks_invoice_sync is
  'One row per Korent order that has been considered for QBO sync. Captures the QBO ids so we can avoid duplicate invoice creates, and the last-attempt outcome so the reconcile cron can retry failures.';

-- RLS: scoped to the owning org just like every other org-keyed table.
alter table quickbooks_invoice_sync enable row level security;

create policy quickbooks_invoice_sync_select on quickbooks_invoice_sync
  for select using (
    organization_id in (
      select organization_id from organization_memberships
       where profile_id = auth.uid() and status = 'active'
    )
  );

create policy quickbooks_invoice_sync_modify on quickbooks_invoice_sync
  for all using (
    organization_id in (
      select organization_id from organization_memberships
       where profile_id = auth.uid() and status = 'active'
        and role in ('owner', 'admin', 'dispatcher')
    )
  ) with check (
    organization_id in (
      select organization_id from organization_memberships
       where profile_id = auth.uid() and status = 'active'
        and role in ('owner', 'admin', 'dispatcher')
    )
  );
