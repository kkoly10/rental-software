-- customer_addresses.organization_id phase-2: backfill + lockdown.
--
-- DO NOT auto-apply this migration. Run it manually after:
--   1. Phase-1 (20260601_050000_*) has been deployed and is live.
--   2. The updated app code (this PR) has been writing organization_id on
--      every INSERT and UPDATE for long enough that there are no
--      unbackfilled rows being added in flight.
--   3. You've eyeballed the backfill SELECT preview against
--      production data to confirm row counts match expectations.
--
-- Steps performed:
--   1. UPDATE every row to copy organization_id from the referenced
--      customers row.
--   2. Verify the count of rows with null organization_id is zero.
--   3. Tighten the column to NOT NULL.
--   4. Drop the legacy customer_id-chain policy now that the direct
--      organization_id policy covers everything.
--
-- The previous TZ-storage incident (rolled-back data migration in #163)
-- is why this file is held out of auto-apply: the operator should be
-- able to dry-run the backfill before committing.

begin;

-- Step 1: backfill from the referenced customer row.
update public.customer_addresses ca
set organization_id = c.organization_id
from public.customers c
where ca.customer_id = c.id
  and ca.organization_id is null;

-- Step 2: hard-fail if anything is still unbackfilled. (RAISE rolls back
-- the transaction, so the constraint and policy changes below are
-- atomic with the data check.)
do $$
declare
  remaining bigint;
begin
  select count(*) into remaining
  from public.customer_addresses
  where organization_id is null;

  if remaining > 0 then
    raise exception 'customer_addresses backfill incomplete: % rows with null organization_id', remaining;
  end if;
end $$;

-- Step 3: tighten the column.
alter table public.customer_addresses
  alter column organization_id set not null;

-- Step 4: drop the legacy chain-based policy. The direct policy added in
-- phase-1 covers every row now that organization_id is required.
drop policy if exists "Org members can manage customer addresses"
  on public.customer_addresses;

commit;
