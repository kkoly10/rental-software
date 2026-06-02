-- Outbox-pattern table for transactional emails. Every send goes through
-- this row first; if the provider (Resend) is down or returns 5xx, the
-- email-retry cron picks the row up after `next_retry_at` and retries
-- with exponential backoff until either it succeeds or `attempts` hits
-- the max.
--
-- Deploy-safety: new isolated table, no FKs back into hot paths beyond
-- the existing org/order/customer references. RLS denies all by default
-- — only the service-role admin client touches this table.

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,

  to_email text not null,
  subject text not null,
  html text not null,
  text_body text,
  reply_to text,
  from_address text,
  headers jsonb not null default '{}'::jsonb,

  idempotency_key text,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  next_retry_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);

create index if not exists idx_email_outbox_due
  on public.email_outbox (next_retry_at)
  where status = 'pending';

create index if not exists idx_email_outbox_org_created
  on public.email_outbox (organization_id, created_at desc);

create index if not exists idx_email_outbox_idempotency
  on public.email_outbox (organization_id, order_id, idempotency_key)
  where idempotency_key is not null;

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
