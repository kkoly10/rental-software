-- Stripe subscription billing columns on organizations
-- Tracks the Stripe customer, active subscription, plan tier, and billing status.

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_plan text,
  add column if not exists subscription_current_period_end timestamptz;

comment on column organizations.stripe_customer_id is 'Stripe Customer ID (cus_xxx)';
comment on column organizations.stripe_subscription_id is 'Active Stripe Subscription ID (sub_xxx)';
comment on column organizations.subscription_status is 'none | trialing | active | past_due | canceled | unpaid';
comment on column organizations.subscription_plan is 'starter | pro | growth';
comment on column organizations.subscription_current_period_end is 'When the current billing period ends';

-- Index for quick lookup by Stripe customer
create index if not exists idx_organizations_stripe_customer
  on organizations (stripe_customer_id)
  where stripe_customer_id is not null;
