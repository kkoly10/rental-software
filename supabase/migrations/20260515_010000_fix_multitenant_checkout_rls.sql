-- Fix multi-tenant checkout RLS: get_public_org_id() returned the oldest org by created_at,
-- breaking anon checkout for every tenant except the first-created org.
--
-- New approach: allow inserts for any organization that actually exists in the table.
-- The application layer enforces tenant isolation via hostname resolution (getPublicOrgId).
-- The RLS policy's job is only to prevent inserts against truly invented UUIDs.

-- Drop the broken single-org helper function
drop function if exists public.get_public_org_id();

-- customers: allow anon insert into any real org
drop policy if exists "Anon can insert customers for public org" on customers;
create policy "Anon can insert customers for any org"
  on customers for insert
  to anon
  with check (organization_id in (select id from organizations));

-- customer_addresses: allow anon insert when the related customer belongs to a real org
drop policy if exists "Anon can insert customer addresses for public org" on customer_addresses;
create policy "Anon can insert customer addresses for any org"
  on customer_addresses for insert
  to anon
  with check (
    customer_id in (
      select id from customers
      where organization_id in (select id from organizations)
    )
  );

-- orders: allow anon insert into any real org
drop policy if exists "Anon can insert orders for public org" on orders;
create policy "Anon can insert orders for any org"
  on orders for insert
  to anon
  with check (organization_id in (select id from organizations));

-- order_items: allow anon insert when the related order belongs to a real org
drop policy if exists "Anon can insert order items for public org" on order_items;
create policy "Anon can insert order items for any org"
  on order_items for insert
  to anon
  with check (
    order_id in (
      select id from orders
      where organization_id in (select id from organizations)
    )
  );
