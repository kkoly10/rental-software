-- Tier-2 launch hardening — webhook idempotency under retry storms.
--
-- The dedup ledger only recorded "I've seen this event." On any handler
-- failure the row was DELETED, releasing the claim — which means a
-- concurrent / retried delivery could observe the row gone and re-run
-- the entire handler, including the side-effects that ALREADY ran
-- before the failure (confirmation email sent, notification created).
-- The unique index on `payments (order_id, provider_payment_id)` saves
-- the payment row from being double-credited, but emails and
-- notifications are unguarded — a flaky email provider during a 5xx
-- retry burst would deliver three confirmations to the customer.
--
-- This widens the ledger so failure ≠ release:
--   - processing_status: claimed (in-flight), succeeded, failed
--   - attempt_count: bumped on every (re)claim, so we can cap retries
--   - last_error: surfaces in observability without grepping logs
--   - finished_at: when the handler returned ok or gave up
--
-- The handler is rewritten in the same PR to:
--   1. INSERT with status=claimed, attempt_count=1
--   2. on uniqueness conflict, UPDATE only if the row is `failed` AND
--      attempt_count < 5 — flipping it back to `claimed` and bumping
--      the counter. A `succeeded` row stays succeeded (true dedup); a
--      `failed` row at the cap stays failed (no retry storm).
--   3. on handler success, UPDATE to status=succeeded.
--   4. on handler failure, UPDATE to status=failed with the error
--      message instead of DELETE-ing the row.

alter table public.stripe_webhook_events
  add column if not exists processing_status text not null default 'claimed'
    check (processing_status in ('claimed', 'succeeded', 'failed')),
  add column if not exists attempt_count int not null default 1
    check (attempt_count >= 1),
  add column if not exists last_error text,
  add column if not exists finished_at timestamptz;

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (processing_status, received_at desc);

comment on column public.stripe_webhook_events.processing_status is
  'claimed = in-flight, succeeded = idempotent dedup target, failed = retry-eligible up to the cap.';
comment on column public.stripe_webhook_events.attempt_count is
  'Bumped on every (re)claim. Capped in app code so a poison-pill event can''t cycle forever.';
