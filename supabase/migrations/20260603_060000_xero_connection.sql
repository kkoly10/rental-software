-- Sprint 3.5 — Xero accounting sync (sibling of the QBO integration)
--
-- Same shape as the QuickBooks columns in 20260603_040000 with two
-- meaningful differences:
--   - Xero uses a "tenant_id" instead of QBO's "realm_id" for the
--     company identifier. The OAuth callback returns no tenant id;
--     we resolve it by calling /connections after token exchange.
--   - Xero refresh tokens have a 60-day expiry (vs QBO's 100), and
--     the access tokens are 30 min (vs QBO's 1 hour). The client
--     module honors both via QboTokens-shaped types adapted per
--     provider.
--
-- Token encryption-at-rest is deferred to the same Supabase Vault
-- migration that will encrypt the QBO tokens — both providers will
-- share that infrastructure (see docs/architecture/quickbooks-online-sync.md).

alter table organizations
  add column if not exists xero_tenant_id text,
  add column if not exists xero_access_token text,
  add column if not exists xero_refresh_token text,
  add column if not exists xero_token_expires_at timestamptz,
  add column if not exists xero_connected_at timestamptz,
  add column if not exists xero_last_sync_at timestamptz,
  add column if not exists xero_last_sync_error text;

create index if not exists idx_organizations_xero_tenant_id
  on organizations(xero_tenant_id)
  where xero_tenant_id is not null;

comment on column organizations.xero_tenant_id is
  'Xero "tenant" identifier (their term for company). Resolved by calling /connections after the OAuth code exchange, then persisted alongside the tokens. Set on connect, cleared on disconnect.';
comment on column organizations.xero_access_token is
  'Short-lived (30 min) Xero access token. Plain-text for the MVP; shares the Sprint 2.5 Vault rollout with QBO.';
comment on column organizations.xero_refresh_token is
  'Long-lived (60 days) Xero refresh token. Same encryption caveat as access token.';
comment on column organizations.xero_token_expires_at is
  'When the access token stops being valid. Refresh is triggered when current time is within 60s of this.';
comment on column organizations.xero_connected_at is
  'When the operator first authorized the connection. Surfaced in the Settings → Integrations card.';
comment on column organizations.xero_last_sync_at is
  'Timestamp of the most recent successful sync. NULL if never synced.';
comment on column organizations.xero_last_sync_error is
  'Last sync failure reason (short string). Surfaced in the Settings → Integrations card.';

create table if not exists xero_invoice_sync (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  xero_invoice_id text,
  xero_contact_id text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed', 'stale')),
  last_attempted_at timestamptz not null default now(),
  last_succeeded_at timestamptz,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, order_id)
);

create index if not exists idx_xero_invoice_sync_status
  on xero_invoice_sync(organization_id, sync_status);
create index if not exists idx_xero_invoice_sync_order
  on xero_invoice_sync(order_id);

comment on table xero_invoice_sync is
  'Per-order sync state mirror of quickbooks_invoice_sync, separate so an org connected to both providers gets independent sync trails.';

alter table xero_invoice_sync enable row level security;

create policy xero_invoice_sync_select on xero_invoice_sync
  for select using (
    organization_id in (
      select organization_id from organization_memberships
       where profile_id = auth.uid() and status = 'active'
    )
  );

create policy xero_invoice_sync_modify on xero_invoice_sync
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
