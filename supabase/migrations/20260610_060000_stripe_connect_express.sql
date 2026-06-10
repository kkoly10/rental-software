-- PR-2 — Stripe Connect Express for operator payments.
--
-- Decision record (docs/marketplace/master-plan.md): the operator
-- SaaS moves from platform-account charges to Connect Express with
-- DIRECT charges — the payment, refunds, and disputes live on the
-- operator's connected account, the operator pays Stripe's
-- processing fees, and Korent is never in the funds flow (no
-- money-transmitter exposure). Option A: no application fee on the
-- operator's own storefront bookings; Korent monetizes via the
-- existing subscription columns. The future marketplace surface
-- reuses these same accounts with application_fee_amount.
--
-- Status columns mirror Stripe's account state machine so the
-- dashboard can render "action required" without a live API call:
--   - details_submitted: operator finished the onboarding form
--   - charges_enabled:   Stripe verified them; checkout may charge
--   - payouts_enabled:   bank account verified; funds can land
-- They sync on: onboarding return, manual refresh, and the
-- account.updated webhook.

alter table public.organizations
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false,
  add column if not exists stripe_connect_onboarded_at timestamptz;

-- One org per connected account — the account.updated webhook looks
-- the org up by acct_xxx, so the mapping must be unambiguous.
create unique index if not exists organizations_stripe_connect_account_idx
  on public.organizations (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
