-- Data integrity constraints identified during audit
--
-- 1. Unique customer email per org — prevents duplicate customer records which
--    fragment order history and make CRM data unreliable.
--    Uses a partial index so orgs with no email (NULL) are not affected.
--
-- 2. Unique route stop sequence per route — prevents race condition in addRouteStop
--    which computed next sequence via COUNT; two concurrent inserts could create
--    duplicate sequence numbers, breaking delivery sort order.

-- Partial unique index: email must be unique within an org, but NULLs are excluded
-- (PostgreSQL treats each NULL as distinct, so existing rows with NULL emails are safe)
create unique index if not exists idx_customers_org_email_unique
  on customers (organization_id, email)
  where email is not null and deleted_at is null;

-- Unique constraint on (route_id, stop_sequence) — atomically prevents duplicate sequences
create unique index if not exists idx_route_stops_route_sequence_unique
  on route_stops (route_id, stop_sequence);
