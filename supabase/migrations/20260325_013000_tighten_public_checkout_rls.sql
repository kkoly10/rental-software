-- Tighten anonymous checkout policies for the single-tenant public storefront.
-- This keeps public checkout working while preventing anon inserts against arbitrary org IDs.

create or replace function public.get_public_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from organizations
  order by created_at asc
  limit 1;
$$;

drop policy if exists "Anon can insert customers" on customers;
create policy "Anon can insert customers for public org"
  on customers for insert
  to anon
  with check (organization_id = public.get_public_org_id());

drop policy if exists "Anon can insert customer addresses" on customer_addresses;
create policy "Anon can insert customer addresses for public org"
  on customer_addresses for insert
  to anon
  with check (
    customer_id in (
      select id
      from customers
      where organization_id = public.get_public_org_id()
    )
  );

drop policy if exists "Anon can insert orders via checkout" on orders;
create policy "Anon can insert orders for public org"
  on orders for insert
  to anon
  with check (organization_id = public.get_public_org_id());

drop policy if exists "Anon can insert order items via checkout" on order_items;
create policy "Anon can insert order items for public org"
  on order_items for insert
  to anon
  with check (
    order_id in (
      select id
      from orders
      where organization_id = public.get_public_org_id()
    )
  );
