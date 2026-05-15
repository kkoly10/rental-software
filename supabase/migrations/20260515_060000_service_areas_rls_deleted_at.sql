-- Fix anon SELECT policy on service_areas to exclude soft-deleted rows.
--
-- The original policy only checked is_active = true, allowing soft-deleted
-- service areas (deleted_at IS NOT NULL) to be returned to anonymous users
-- if is_active was still true at deletion time.

drop policy if exists "Anon can view service areas" on service_areas;

create policy "Anon can view service areas"
  on service_areas
  for select
  to anon
  using (is_active = true and deleted_at is null);
