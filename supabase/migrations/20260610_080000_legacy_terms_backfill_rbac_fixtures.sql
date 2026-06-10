-- PR-3a — silent backfill for the 4 RBAC test fixtures.
--
-- The Tier-3 fix made the signup action stamp terms_accepted_at,
-- but 7 profiles predated the fix and carried NULL. 4 of those are
-- RBAC test fixtures (`*@rbac-pwtest.invalid`) created by the
-- automated test seed — backfilling them with their created_at is
-- the obvious right move (the fixtures never literally "accepted"
-- anything, they're synthetic; the column is meaningful only for
-- real human profiles).
--
-- The 3 remaining real accounts (komlankouhiko@icloud.com,
-- comlan11@gmail.com, shehaba24@proton.me) get a record-on-next-
-- login shim in lib/auth/* — they'll stamp the row at next sign-in
-- with the actual IP. Skipping them here keeps the audit honest:
-- their terms_accepted_at will reflect the real moment they
-- re-authenticated and agreed.
--
-- Terms version is recorded as 'legacy' so a regulator query can
-- separate true acceptances from synthetic backfills.

update public.profiles
   set terms_accepted_at = coalesce(terms_accepted_at, created_at),
       terms_version = coalesce(terms_version, 'legacy')
 where terms_accepted_at is null
   and email like '%@rbac-pwtest.invalid';
