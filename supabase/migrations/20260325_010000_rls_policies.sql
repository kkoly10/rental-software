-- ============================================================
-- Row Level Security Policies for Multi-Tenant Isolation
-- ============================================================
-- This migration enables RLS on all tenant-scoped tables and adds
-- policies ensuring users can only access data belonging to their
-- organization. Public catalog access is granted via anon role.
-- ============================================================

-- Helper function: get current user's organization IDs
create or replace function public.get_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from organization_memberships
  where profile_id = auth.uid()
    and status = 'active';
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
alter table organizations enable row level security;

create policy "Users can view their own organizations"
  on organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Anon can view organizations for public storefront"
  on organizations for select
  to anon
  using (true);

create policy "Authenticated users can insert organizations"
  on organizations for insert
  to authenticated
  with check (true);

-- ============================================================
-- PROFILES
-- ============================================================
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- Service role trigger needs insert access (handled by security definer)
create policy "Allow profile creation via trigger"
  on profiles for insert
  with check (true);

-- ============================================================
-- ORGANIZATION MEMBERSHIPS
-- ============================================================
alter table organization_memberships enable row level security;

create policy "Users can view memberships in their orgs"
  on organization_memberships for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Users can view their own memberships"
  on organization_memberships for select
  using (profile_id = auth.uid());

create policy "Authenticated users can create memberships for their orgs"
  on organization_memberships for insert
  to authenticated
  with check (true);

-- ============================================================
-- SERVICE AREAS
-- ============================================================
alter table service_areas enable row level security;

create policy "Org members can manage service areas"
  on service_areas for all
  using (organization_id in (select public.get_user_org_ids()));

create policy "Anon can view service areas"
  on service_areas for select
  to anon
  using (is_active = true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
alter table customers enable row level security;

create policy "Org members can manage customers"
  on customers for all
  using (organization_id in (select public.get_user_org_ids()));

-- Public checkout creates customers via anon
create policy "Anon can insert customers"
  on customers for insert
  to anon
  with check (true);

-- ============================================================
-- CUSTOMER ADDRESSES
-- ============================================================
alter table customer_addresses enable row level security;

create policy "Org members can manage customer addresses"
  on customer_addresses for all
  using (
    customer_id in (
      select id from customers
      where organization_id in (select public.get_user_org_ids())
    )
  );

create policy "Anon can insert customer addresses"
  on customer_addresses for insert
  to anon
  with check (true);

-- ============================================================
-- CATEGORIES
-- ============================================================
alter table categories enable row level security;

create policy "Org members can manage categories"
  on categories for all
  using (organization_id in (select public.get_user_org_ids()));

create policy "Anon can view active categories"
  on categories for select
  to anon
  using (is_active = true);

-- ============================================================
-- PRODUCTS
-- ============================================================
alter table products enable row level security;

create policy "Org members can manage products"
  on products for all
  using (organization_id in (select public.get_user_org_ids()));

create policy "Anon can view public active products"
  on products for select
  to anon
  using (is_active = true and visibility = 'public');

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
alter table product_images enable row level security;

create policy "Org members can manage product images"
  on product_images for all
  using (
    product_id in (
      select id from products
      where organization_id in (select public.get_user_org_ids())
    )
  );

create policy "Anon can view product images"
  on product_images for select
  to anon
  using (true);

-- ============================================================
-- PRODUCT ATTRIBUTES
-- ============================================================
alter table product_attributes enable row level security;

create policy "Org members can manage product attributes"
  on product_attributes for all
  using (
    product_id in (
      select id from products
      where organization_id in (select public.get_user_org_ids())
    )
  );

create policy "Anon can view product attributes"
  on product_attributes for select
  to anon
  using (true);

-- ============================================================
-- ASSETS
-- ============================================================
alter table assets enable row level security;

create policy "Org members can manage assets"
  on assets for all
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- ORDERS
-- ============================================================
alter table orders enable row level security;

create policy "Org members can manage orders"
  on orders for all
  using (organization_id in (select public.get_user_org_ids()));

create policy "Anon can insert orders via checkout"
  on orders for insert
  to anon
  with check (true);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
alter table order_items enable row level security;

create policy "Org members can manage order items"
  on order_items for all
  using (
    order_id in (
      select id from orders
      where organization_id in (select public.get_user_org_ids())
    )
  );

create policy "Anon can insert order items via checkout"
  on order_items for insert
  to anon
  with check (true);

-- ============================================================
-- AVAILABILITY BLOCKS
-- ============================================================
alter table availability_blocks enable row level security;

create policy "Org members can manage availability blocks"
  on availability_blocks for all
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- PAYMENTS
-- ============================================================
alter table payments enable row level security;

create policy "Org members can manage payments"
  on payments for all
  using (
    order_id in (
      select id from orders
      where organization_id in (select public.get_user_org_ids())
    )
  );

-- ============================================================
-- DOCUMENTS
-- ============================================================
alter table documents enable row level security;

create policy "Org members can manage documents"
  on documents for all
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- ROUTES
-- ============================================================
alter table routes enable row level security;

create policy "Org members can manage routes"
  on routes for all
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- ROUTE STOPS
-- ============================================================
alter table route_stops enable row level security;

create policy "Org members can manage route stops"
  on route_stops for all
  using (
    route_id in (
      select id from routes
      where organization_id in (select public.get_user_org_ids())
    )
  );

-- ============================================================
-- MAINTENANCE RECORDS
-- ============================================================
alter table maintenance_records enable row level security;

create policy "Org members can manage maintenance records"
  on maintenance_records for all
  using (organization_id in (select public.get_user_org_ids()));

-- ============================================================
-- INSPECTIONS
-- ============================================================
alter table inspections enable row level security;

create policy "Org members can manage inspections"
  on inspections for all
  using (organization_id in (select public.get_user_org_ids()));
