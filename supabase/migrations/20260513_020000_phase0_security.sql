-- ============================================================
-- Phase 0 security hardening
-- ============================================================

-- 1. Tighten organization_memberships INSERT policy.
--    The old WITH CHECK (true) allowed any authenticated user to add
--    themselves (or anyone) as owner of any org. Now restricted to:
--    - profile_id must be the calling user (can't insert on behalf of others)
--    - a valid pending team_invite must exist for that org + email
--    bootstrap_organization() is SECURITY DEFINER and bypasses RLS entirely.

drop policy if exists "Authenticated users can create memberships for their orgs"
  on organization_memberships;

create policy "Users can join via valid team invite"
  on organization_memberships for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from team_invites
      where team_invites.organization_id = organization_memberships.organization_id
        and team_invites.invited_email = (
          select email from auth.users where id = auth.uid()
        )
        and team_invites.status = 'pending'
        and team_invites.expires_at > now()
    )
  );

-- 2. Prevent duplicate active memberships for the same user + org.
--    Partial so that revoked/inactive historical rows are still allowed.

create unique index if not exists uniq_active_org_membership
  on organization_memberships(organization_id, profile_id)
  where status = 'active';

-- 3. Add dedup flag for day-before reminders.
--    The cron now filters on IS NULL and stamps after a successful send,
--    so each order receives exactly one reminder regardless of cron frequency.

alter table orders
  add column if not exists day_before_reminder_sent_at timestamptz;

-- 4. Create uploads bucket and add RLS policies.
--    Used by crew mobile for delivery proof photos. Authenticated access only;
--    the bucket is private (not publicly readable via URL without a signed URL).

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload to uploads bucket" on storage.objects;
create policy "Authenticated users can upload to uploads bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'uploads');

drop policy if exists "Authenticated users can read uploads bucket" on storage.objects;
create policy "Authenticated users can read uploads bucket"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'uploads');

drop policy if exists "Authenticated users can delete from uploads bucket" on storage.objects;
create policy "Authenticated users can delete from uploads bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'uploads');
