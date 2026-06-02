-- perf: index for the SMS log dashboard page query.
--
-- lib/data/sms-log.ts filters by (organization_id, channel = 'sms')
-- and orders by created_at desc. The two existing communication_log
-- indexes are scoped to either (org, order_id, created_at) or
-- (org, customer_id, created_at) — neither covers the org-wide
-- channel-filtered query, which falls back to a sequential scan at
-- scale (~100k+ rows per org).
--
-- The other "missing indexes" called out by the recon (#90 orders +
-- #92 customers + #96 availability_blocks) turned out to already
-- exist under different names — confirmed via pg_indexes inspection.
create index if not exists idx_communication_log_org_channel_created_at
  on public.communication_log (organization_id, channel, created_at desc);
