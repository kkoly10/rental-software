-- Sprint 3 — Recurring booking series
--
-- Booqable's documented weakness: it can't auto-generate monthly
-- bookings for long-running rentals (tents, generators, equipment).
-- Goodshuffle Pro doesn't ship this either. Sprint 3 closes the gap.
--
-- Design choice: each cycle produces a NEW child order with its own
-- event_date, not a single long-running order with monthly billing
-- periods. This keeps the model consistent with the existing per-
-- event order shape and lets the operator handle each cycle's
-- delivery / pickup / payment independently. The customer experience
-- is "recurring booking" but the data model is "auto-generated
-- orders linked to a series."
--
-- Two-table shape:
--   * order_series — the parent. Holds the cadence rule + lifecycle
--     state. Created when the operator hits "Make recurring" on a
--     template order.
--   * orders.order_series_id — back-pointer on each child order so
--     the operator can navigate from a child to its series and the
--     UI can render "Part of weekly series" badges.

create table if not exists order_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  template_order_id uuid references orders(id) on delete set null,

  -- Cadence. `frequency` is the base unit; `interval_count` is the
  -- multiplier. ("Every 2 weeks" = frequency='weekly', interval=2.)
  frequency text not null
    check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  interval_count integer not null default 1
    check (interval_count >= 1 and interval_count <= 52),

  -- Window. `start_date` is the first occurrence; series terminates
  -- on whichever of end_date OR max_occurrences hits first. Both
  -- nullable means "indefinite" — the daily-expand cron caps it at
  -- 24 months out so storage doesn't run away.
  start_date date not null,
  end_date date,
  max_occurrences integer,

  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled', 'completed')),
  last_generated_through date,

  created_at timestamptz not null default now(),
  created_by_profile_id uuid references profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by_profile_id uuid references profiles(id) on delete set null,
  deleted_at timestamptz
);

create index if not exists idx_order_series_org_status
  on order_series(organization_id, status)
  where deleted_at is null;
create index if not exists idx_order_series_customer
  on order_series(customer_id)
  where deleted_at is null;
create index if not exists idx_order_series_active_expand
  on order_series(organization_id, last_generated_through)
  where status = 'active' and deleted_at is null;

comment on table order_series is
  'Recurring booking series. Parent record that drives auto-generation of child orders on a cadence. See docs/architecture/recurring-bookings.md.';
comment on column order_series.frequency is
  'Cadence base unit. Combined with interval_count to express "every N weeks/months." Discrete values match the operator-facing UI choices.';
comment on column order_series.interval_count is
  'Cadence multiplier. 1 = every cycle, 2 = every other cycle, etc. Capped at 52 to prevent operators from accidentally creating a "every 100 weeks" series that the UI handles poorly.';
comment on column order_series.last_generated_through is
  'Most recent event_date the auto-expand has emitted a child order for. The daily cron picks up here.';

-- Child-order back-pointer.
alter table orders
  add column if not exists order_series_id uuid references order_series(id) on delete set null,
  add column if not exists series_occurrence_number integer;

create index if not exists idx_orders_order_series_id
  on orders(order_series_id)
  where order_series_id is not null;

comment on column orders.order_series_id is
  'NULL for one-off orders. When set, this order is part of an auto-generated recurring series; cancellation of an individual child does not cancel the series unless the operator opts in explicitly.';
comment on column orders.series_occurrence_number is
  'Position of this order in its series (1-indexed). Surfaced in the UI as "Occurrence 3 of 12" so the operator can orient themselves.';

-- RLS for order_series mirrors orders: members can read, dispatcher+
-- can write. Keep the policies tight so a viewer-role user can't
-- accidentally cancel a series.
alter table order_series enable row level security;

create policy order_series_select on order_series
  for select using (
    organization_id in (
      select organization_id from organization_memberships
       where profile_id = auth.uid() and status = 'active'
    )
  );

create policy order_series_modify on order_series
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
