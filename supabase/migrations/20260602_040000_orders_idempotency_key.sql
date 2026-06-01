-- concurrency: idempotency_key on orders for safe browser-retry semantics.
--
-- Scenario: a customer (or operator) submits a booking form, the network
-- hiccups, the browser retries POST /create-order. The server already
-- successfully created an order on the first call but the response was
-- never received; the retry would create a *second* order with
-- duplicated items. The audit (#37) flagged this and the original PR 9
-- plan suggested a unique index on (order_id, product_id) — but
-- order_items has line_type + quantity columns that legitimately allow
-- the same product on one order, so that constraint would block real
-- workflows. The right key is a client-generated nonce attached to the
-- *submission*, not to the data shape.
--
-- Schema:
--   orders.idempotency_key text NULL (NULL = no key; existing rows
--     and any client that doesn't send one).
--   Unique (organization_id, idempotency_key) WHERE idempotency_key
--   IS NOT NULL AND deleted_at IS NULL — partial so the column stays
--   optional and soft-deleted rows don't block a retry.
--
-- Server-side flow (PR companion):
--   1. Read idempotency_key from the form. If present and a non-deleted
--      order with the same (org, key) already exists, return that
--      order's response (success with same orderNumber).
--   2. Otherwise INSERT with idempotency_key set. A concurrent retry
--      that arrives mid-flight hits the unique constraint, falls back
--      to step 1's SELECT, and returns the original response.
--
-- No backfill — existing orders stay NULL.

alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists idx_orders_idempotency_key_unique
  on public.orders (organization_id, idempotency_key)
  where idempotency_key is not null and deleted_at is null;

comment on column public.orders.idempotency_key is
  'Client-generated nonce identifying a single submission. Used to deduplicate browser/network retries of POST /create-order. Optional; only enforced via partial unique index when present.';
