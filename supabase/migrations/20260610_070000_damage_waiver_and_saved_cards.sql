-- PR-2c — damage waiver (per-product opt-in surcharge) + saved-card
-- customer model (for post-event damage charges).
--
-- Damage waiver: optional surcharge the customer agrees to at
-- checkout that caps their liability for accidental damage. Industry
-- standard ~8-12% of subtotal; the operator sets a per-product rate
-- in basis points (null = waiver not offered). The line is recorded
-- as its own order_item with line_type='damage_waiver' so it surfaces
-- on invoices/exports without changing the product line.
--
-- Saved-card model: customers gain a Connect customer id (`acct_xxx`-
-- scoped, on the operator's connected Stripe account) and a
-- payment_methods table mirroring the cards Stripe holds. Lets the
-- operator initiate a post-event damage charge against the saved
-- card off-session without re-collecting a number. Cards are saved
-- via `setup_future_usage='on_session'` on the deposit and synced
-- through the `payment_method.attached` webhook.

alter table public.products
  add column if not exists damage_waiver_rate_bps integer;

alter table public.products
  add constraint products_damage_waiver_rate_bps_range
    check (damage_waiver_rate_bps is null or (damage_waiver_rate_bps >= 0 and damage_waiver_rate_bps <= 5000))
    not valid;
alter table public.products validate constraint products_damage_waiver_rate_bps_range;

-- Customer-side Connect — one Stripe Customer per (organization, customer)
-- so a customer who rents from two operators ends up with two acct-scoped
-- customer ids (the right model for direct charges). Lives on the
-- customers row; the operator-side stripe_customer_id is the org's
-- Subscription billing customer and was preserved in PR-1.

alter table public.customers
  add column if not exists stripe_customer_id text;

create unique index if not exists customers_stripe_customer_id_idx
  on public.customers (stripe_customer_id)
  where stripe_customer_id is not null and deleted_at is null;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  stripe_payment_method_id text not null,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payment_methods_card_exp_month_range
    check (card_exp_month is null or (card_exp_month between 1 and 12)),
  constraint payment_methods_card_exp_year_range
    check (card_exp_year is null or (card_exp_year between 2000 and 2999))
);

-- One row per Stripe payment method id; webhook is the source of truth
-- so the index dedups concurrent attach events.
create unique index payment_methods_stripe_id_idx
  on public.payment_methods (stripe_payment_method_id)
  where deleted_at is null;

create index payment_methods_customer_idx
  on public.payment_methods (organization_id, customer_id)
  where deleted_at is null;

alter table public.payment_methods enable row level security;

-- Operators of the org can read + manage their customers' methods.
-- (Customers don't access this table directly; the portal surfaces
-- a single saved-card hint only.)
create policy payment_methods_select on public.payment_methods
  for select using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = payment_methods.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy payment_methods_insert on public.payment_methods
  for insert with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = payment_methods.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'dispatcher')
    )
  );

create policy payment_methods_update on public.payment_methods
  for update using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = payment_methods.organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'dispatcher')
    )
  );

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();
