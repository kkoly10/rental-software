-- ── 1. Uploads bucket RLS: scope to org membership ───────────────────────────
-- The previous policies used only `bucket_id = 'uploads'` which let any
-- authenticated user read or delete another tenant's proof photos.
-- Path format enforced by the crew mobile action: proof-photos/{org_id}/{file}

drop policy if exists "Authenticated users can upload to uploads bucket" on storage.objects;
drop policy if exists "Authenticated users can read uploads bucket"       on storage.objects;
drop policy if exists "Authenticated users can delete from uploads bucket" on storage.objects;

create policy "Org members can upload to their folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and exists (
      select 1 from organization_memberships
      where organization_id = split_part(name, '/', 2)::uuid
        and profile_id = auth.uid()
        and status = 'active'
    )
  );

create policy "Org members can read their folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from organization_memberships
      where organization_id = split_part(name, '/', 2)::uuid
        and profile_id = auth.uid()
        and status = 'active'
    )
  );

create policy "Org members can delete from their folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from organization_memberships
      where organization_id = split_part(name, '/', 2)::uuid
        and profile_id = auth.uid()
        and status = 'active'
    )
  );

-- ── 2. Partial index for day-before reminder cron filter ──────────────────────
-- The cron queries: event_date = $tomorrow AND order_status IN (...) AND
-- day_before_reminder_sent_at IS NULL. Without an index this is a full scan.
-- The partial index covers only unsent rows so it stays small over time.

create index if not exists idx_orders_pending_day_before_reminder
  on orders(event_date)
  where day_before_reminder_sent_at is null;
