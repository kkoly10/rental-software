-- ============================================================
-- Combined Supabase migrations for project gotyqamdmjxadntkvhkk
-- Generated 2026-05-26T20:52:01Z from supabase/migrations/
-- Run order = filename order. Paste into the Supabase SQL Editor,
-- or run:  psql "<connection-string>" -f all_migrations_combined.sql
-- ============================================================

-- ===== BEGIN 20260324_120000_initial_schema.sql =====
create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'inflatable',
  timezone text not null default 'America/New_York',
  default_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists service_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  zip_code text,
  city text,
  state text,
  delivery_fee numeric(10,2) not null default 0,
  minimum_order_amount numeric(10,2) not null default 0,
  is_active boolean not null default true
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  line1 text not null,
  line2 text,
  city text,
  state text,
  postal_code text,
  is_default_delivery boolean not null default false,
  is_default_billing boolean not null default false
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null,
  vertical text not null default 'inflatable',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (organization_id, slug)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null,
  short_description text,
  description text,
  rental_mode text not null default 'catalog_only',
  pricing_model text not null default 'flat_day',
  base_price numeric(10,2) not null default 0,
  security_deposit_amount numeric(10,2) not null default 0,
  requires_serialized_asset boolean not null default false,
  requires_delivery boolean not null default true,
  is_active boolean not null default true,
  visibility text not null default 'public',
  unique (organization_id, slug)
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false
);

create table if not exists product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  attribute_key text not null,
  attribute_value text,
  attribute_group text
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  asset_tag text not null,
  serial_number text,
  vin_or_identifier text,
  purchase_date date,
  condition_status text not null default 'good',
  operational_status text not null default 'ready',
  location_label text,
  notes text,
  unique (organization_id, asset_tag)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  order_number text not null,
  order_status text not null default 'inquiry',
  quote_status text,
  event_date date,
  event_start_time timestamptz,
  event_end_time timestamptz,
  delivery_address_id uuid references customer_addresses(id) on delete set null,
  billing_address_id uuid references customer_addresses(id) on delete set null,
  subtotal_amount numeric(10,2) not null default 0,
  delivery_fee_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  deposit_due_amount numeric(10,2) not null default 0,
  balance_due_amount numeric(10,2) not null default 0,
  source_channel text,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  line_type text not null default 'rental',
  quantity integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  item_name_snapshot text,
  notes text
);

create table if not exists availability_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  block_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  source_order_id uuid references orders(id) on delete set null
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text,
  provider_payment_id text,
  payment_type text not null,
  payment_status text not null default 'pending',
  amount numeric(10,2) not null default 0,
  paid_at timestamptz,
  failure_reason text
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  document_type text not null,
  document_status text not null default 'pending',
  file_url text,
  signed_at timestamptz,
  expires_at timestamptz
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  route_date date not null,
  name text,
  assigned_vehicle text,
  assigned_driver_profile_id uuid references profiles(id) on delete set null,
  route_status text not null default 'planned'
);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  stop_type text not null,
  stop_sequence integer not null default 0,
  scheduled_window_start timestamptz,
  scheduled_window_end timestamptz,
  stop_status text not null default 'assigned',
  proof_photo_url text,
  signature_name text,
  completed_at timestamptz
);

create table if not exists maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  maintenance_type text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  vendor_name text,
  cost_amount numeric(10,2) not null default 0,
  notes text
);

create table if not exists inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  inspection_type text not null,
  performed_by_profile_id uuid references profiles(id) on delete set null,
  inspection_status text not null default 'pending',
  checklist_json jsonb,
  damage_notes text,
  completed_at timestamptz
);

create index if not exists idx_categories_org_slug on categories (organization_id, slug);
create index if not exists idx_products_org_slug on products (organization_id, slug);
create index if not exists idx_orders_org_event_date on orders (organization_id, event_date);
create index if not exists idx_orders_org_status on orders (organization_id, order_status);
create index if not exists idx_assets_org_tag on assets (organization_id, asset_tag);
create index if not exists idx_availability_blocks_time on availability_blocks (starts_at, ends_at);
create index if not exists idx_route_stops_status on route_stops (stop_status);

-- ===== END 20260324_120000_initial_schema.sql =====

-- ===== BEGIN 20260324_121500_auth_profile_sync.sql =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when excluded.full_name <> '' then excluded.full_name
          else profiles.full_name
        end,
        phone = case
          when excluded.phone <> '' then excluded.phone
          else profiles.phone
        end;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ===== END 20260324_121500_auth_profile_sync.sql =====

-- ===== BEGIN 20260325_010000_rls_policies.sql =====
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

-- ===== END 20260325_010000_rls_policies.sql =====

-- ===== BEGIN 20260325_013000_tighten_public_checkout_rls.sql =====
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

-- ===== END 20260325_013000_tighten_public_checkout_rls.sql =====

-- ===== BEGIN 20260325_020000_product_image_storage.sql =====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public product images are viewable" on storage.objects;
create policy "Public product images are viewable"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- ===== END 20260325_020000_product_image_storage.sql =====

-- ===== BEGIN 20260325_023000_fix_onboarding_organization_rls.sql =====
-- Fix onboarding bootstrap so authenticated users can create their first organization.
-- Safe to run even if earlier RLS migration was partially applied.

alter table public.organizations enable row level security;

drop policy if exists "Users can view their own organizations" on public.organizations;
drop policy if exists "Anon can view organizations for public storefront" on public.organizations;
drop policy if exists "Authenticated users can insert organizations" on public.organizations;
drop policy if exists "Authenticated users can create organizations during onboarding" on public.organizations;

create policy "Users can view their own organizations"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Anon can view organizations for public storefront"
  on public.organizations for select
  to anon
  using (true);

create policy "Authenticated users can create organizations during onboarding"
  on public.organizations for insert
  to authenticated
  with check (auth.uid() is not null);

-- ===== END 20260325_023000_fix_onboarding_organization_rls.sql =====

-- ===== BEGIN 20260325_030000_org_settings_payment_method.sql =====
-- Add settings JSONB column to organizations for website configuration.
-- Add support_email and phone columns to organizations for editable business profile.
-- Add payment_method and reference_note columns to payments for manual payment recording.

alter table organizations add column if not exists settings jsonb not null default '{}'::jsonb;
alter table organizations add column if not exists support_email text;
alter table organizations add column if not exists phone text;

alter table payments add column if not exists payment_method text;
alter table payments add column if not exists reference_note text;

-- ===== END 20260325_030000_org_settings_payment_method.sql =====

-- ===== BEGIN 20260326_010000_user_guidance_state.sql =====
-- User guidance state for operator support system
-- Tracks welcome modal, tour completion, and dismissed help banners per user

create table if not exists public.user_guidance_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  has_seen_welcome boolean not null default false,
  has_completed_tour boolean not null default false,
  dismissed_help jsonb not null default '{}'::jsonb,
  dismissed_checklist boolean not null default false,
  tour_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: users can only read/update their own guidance state
alter table public.user_guidance_state enable row level security;

create policy "Users can read own guidance state"
  on public.user_guidance_state for select
  using (auth.uid() = profile_id);

create policy "Users can insert own guidance state"
  on public.user_guidance_state for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own guidance state"
  on public.user_guidance_state for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Auto-update updated_at on changes
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_guidance_state_updated_at
  before update on public.user_guidance_state
  for each row execute function public.set_updated_at();

-- ===== END 20260326_010000_user_guidance_state.sql =====

-- ===== BEGIN 20260326_020000_rate_limits.sql =====
create table if not exists public.rate_limit_windows (
  scope text not null,
  actor_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, actor_key, window_start)
);

alter table public.rate_limit_windows enable row level security;

create or replace function public.set_row_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rate_limit_windows_updated_at
  before update on public.rate_limit_windows
  for each row execute function public.set_row_updated_at();

create or replace function public.apply_rate_limit(
  p_scope text,
  p_actor_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_request_count integer;
begin
  if p_limit <= 0 then
    raise exception 'p_limit must be greater than zero';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than zero';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_windows as rl (
    scope,
    actor_key,
    window_start,
    request_count
  )
  values (
    p_scope,
    p_actor_key,
    v_window_start,
    1
  )
  on conflict (scope, actor_key, window_start)
  do update set
    request_count = rl.request_count + 1,
    updated_at = now()
  returning rl.request_count into v_request_count;

  return query
  select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    greatest(ceil(extract(epoch from (v_window_end - now())))::integer, 0);
end;
$$;

revoke all on public.rate_limit_windows from anon, authenticated;
revoke all on function public.apply_rate_limit(text, text, integer, integer) from anon, authenticated;

-- ===== END 20260326_020000_rate_limits.sql =====

-- ===== BEGIN 20260327_010000_service_area_availability_support.sql =====
alter table public.service_areas
  add column if not exists postal_codes text[] not null default '{}';

update public.service_areas
set postal_codes = array[zip_code]
where zip_code is not null
  and trim(zip_code) <> ''
  and cardinality(postal_codes) = 0;

create index if not exists idx_service_areas_org_active_zip
  on public.service_areas (organization_id, is_active, zip_code);

create index if not exists idx_service_areas_org_city_state
  on public.service_areas (organization_id, is_active, city, state);

create index if not exists idx_service_areas_postal_codes_gin
  on public.service_areas using gin (postal_codes);

create index if not exists idx_availability_blocks_org_product_window
  on public.availability_blocks (organization_id, product_id, starts_at, ends_at);

create index if not exists idx_availability_blocks_org_order
  on public.availability_blocks (organization_id, source_order_id);

-- ===== END 20260327_010000_service_area_availability_support.sql =====

-- ===== BEGIN 20260327_020000_updated_at_soft_delete_foundation.sql =====
alter table public.organizations add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.organization_memberships add column if not exists updated_at timestamptz not null default now();
alter table public.service_areas add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.customer_addresses add column if not exists updated_at timestamptz not null default now();
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.product_images add column if not exists updated_at timestamptz not null default now();
alter table public.product_attributes add column if not exists updated_at timestamptz not null default now();
alter table public.assets add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.order_items add column if not exists updated_at timestamptz not null default now();
alter table public.availability_blocks add column if not exists updated_at timestamptz not null default now();
alter table public.payments add column if not exists updated_at timestamptz not null default now();
alter table public.documents add column if not exists updated_at timestamptz not null default now();
alter table public.routes add column if not exists updated_at timestamptz not null default now();
alter table public.route_stops add column if not exists updated_at timestamptz not null default now();
alter table public.maintenance_records add column if not exists updated_at timestamptz not null default now();
alter table public.inspections add column if not exists updated_at timestamptz not null default now();

alter table public.service_areas add column if not exists deleted_at timestamptz;
alter table public.customers add column if not exists deleted_at timestamptz;
alter table public.customer_addresses add column if not exists deleted_at timestamptz;
alter table public.categories add column if not exists deleted_at timestamptz;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.product_images add column if not exists deleted_at timestamptz;
alter table public.assets add column if not exists deleted_at timestamptz;

create or replace function public.ensure_updated_at_trigger(p_table regclass, p_trigger_name text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = p_table
      and tgname = p_trigger_name
      and not tgisinternal
  ) then
    execute format(
      'create trigger %I before update on %s for each row execute function public.set_row_updated_at()',
      p_trigger_name,
      p_table
    );
  end if;
end;
$$;

select public.ensure_updated_at_trigger('public.organizations', 'organizations_updated_at');
select public.ensure_updated_at_trigger('public.profiles', 'profiles_updated_at');
select public.ensure_updated_at_trigger('public.organization_memberships', 'organization_memberships_updated_at');
select public.ensure_updated_at_trigger('public.service_areas', 'service_areas_updated_at');
select public.ensure_updated_at_trigger('public.customers', 'customers_updated_at');
select public.ensure_updated_at_trigger('public.customer_addresses', 'customer_addresses_updated_at');
select public.ensure_updated_at_trigger('public.categories', 'categories_updated_at');
select public.ensure_updated_at_trigger('public.products', 'products_updated_at');
select public.ensure_updated_at_trigger('public.product_images', 'product_images_updated_at');
select public.ensure_updated_at_trigger('public.product_attributes', 'product_attributes_updated_at');
select public.ensure_updated_at_trigger('public.assets', 'assets_updated_at');
select public.ensure_updated_at_trigger('public.orders', 'orders_updated_at');
select public.ensure_updated_at_trigger('public.order_items', 'order_items_updated_at');
select public.ensure_updated_at_trigger('public.availability_blocks', 'availability_blocks_updated_at');
select public.ensure_updated_at_trigger('public.payments', 'payments_updated_at');
select public.ensure_updated_at_trigger('public.documents', 'documents_updated_at');
select public.ensure_updated_at_trigger('public.routes', 'routes_updated_at');
select public.ensure_updated_at_trigger('public.route_stops', 'route_stops_updated_at');
select public.ensure_updated_at_trigger('public.maintenance_records', 'maintenance_records_updated_at');
select public.ensure_updated_at_trigger('public.inspections', 'inspections_updated_at');

alter table public.categories drop constraint if exists categories_organization_id_slug_key;
alter table public.products drop constraint if exists products_organization_id_slug_key;
alter table public.assets drop constraint if exists assets_organization_id_asset_tag_key;

create unique index if not exists idx_categories_org_slug_active
  on public.categories (organization_id, slug)
  where deleted_at is null;

create unique index if not exists idx_products_org_slug_active
  on public.products (organization_id, slug)
  where deleted_at is null;

create unique index if not exists idx_assets_org_asset_tag_active
  on public.assets (organization_id, asset_tag)
  where deleted_at is null;

create index if not exists idx_customers_org_active_created_at
  on public.customers (organization_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_products_org_active_name
  on public.products (organization_id, name)
  where deleted_at is null;

create index if not exists idx_service_areas_org_active_label
  on public.service_areas (organization_id, label)
  where deleted_at is null;

-- ===== END 20260327_020000_updated_at_soft_delete_foundation.sql =====

-- ===== BEGIN 20260327_040000_observability.sql =====
create table if not exists public.app_event_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  action text not null,
  status text not null default 'info',
  route text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  message text not null,
  route text null,
  stack text null,
  context jsonb not null default '{}'::jsonb
);

alter table public.app_event_logs enable row level security;
alter table public.app_error_logs enable row level security;

revoke all on public.app_event_logs from anon, authenticated;
revoke all on public.app_error_logs from anon, authenticated;

create index if not exists idx_app_event_logs_created_at on public.app_event_logs(created_at desc);
create index if not exists idx_app_event_logs_source on public.app_event_logs(source, created_at desc);
create index if not exists idx_app_error_logs_created_at on public.app_error_logs(created_at desc);
create index if not exists idx_app_error_logs_source on public.app_error_logs(source, created_at desc);

-- ===== END 20260327_040000_observability.sql =====

-- ===== BEGIN 20260330_010000_stripe_subscriptions.sql =====
-- Stripe subscription billing columns on organizations
-- Tracks the Stripe customer, active subscription, plan tier, and billing status.

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_plan text,
  add column if not exists subscription_current_period_end timestamptz;

comment on column organizations.stripe_customer_id is 'Stripe Customer ID (cus_xxx)';
comment on column organizations.stripe_subscription_id is 'Active Stripe Subscription ID (sub_xxx)';
comment on column organizations.subscription_status is 'none | trialing | active | past_due | canceled | unpaid';
comment on column organizations.subscription_plan is 'starter | pro | growth';
comment on column organizations.subscription_current_period_end is 'When the current billing period ends';

-- Index for quick lookup by Stripe customer
create index if not exists idx_organizations_stripe_customer
  on organizations (stripe_customer_id)
  where stripe_customer_id is not null;

-- ===== END 20260330_010000_stripe_subscriptions.sql =====

-- ===== BEGIN 20260330_020000_team_invites.sql =====
-- Team invites table for pending invitations
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_email text not null,
  role text not null default 'viewer',
  invited_by_profile_id uuid not null references profiles(id),
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invites_token on team_invites (token) where status = 'pending';
create index if not exists idx_team_invites_org on team_invites (organization_id);

-- RLS policies for team_invites
alter table team_invites enable row level security;

create policy "Org members can view invites"
  on team_invites for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Org owners/admins can manage invites"
  on team_invites for all
  using (organization_id in (select public.get_user_org_ids()));

-- Add updated_at to organization_memberships if missing
alter table organization_memberships
  add column if not exists updated_at timestamptz not null default now();

-- ===== END 20260330_020000_team_invites.sql =====

-- ===== BEGIN 20260330_030000_add_dismissed_milestones.sql =====
-- Add dismissed_milestones column to user_guidance_state
-- Tracks which milestone celebration toasts the user has already seen

ALTER TABLE public.user_guidance_state
ADD COLUMN IF NOT EXISTS dismissed_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== END 20260330_030000_add_dismissed_milestones.sql =====

-- ===== BEGIN 20260331_010000_innovative_features.sql =====
-- Migration for innovative features: document signing, portal enhancements
-- All brand/pricing/SMS settings are stored in organizations.settings jsonb (no schema change needed)

-- Add document signing columns for customer self-service portal
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS signed_date timestamptz,
ADD COLUMN IF NOT EXISTS signer_name text;

-- Add index for faster portal document lookups by order
CREATE INDEX IF NOT EXISTS idx_documents_order_status
  ON public.documents (order_id, document_status);

-- Add index for portal order lookup by order_number
CREATE INDEX IF NOT EXISTS idx_orders_org_number
  ON public.orders (organization_id, order_number);

-- Add index for route stops ordering (for visual route planner)
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence
  ON public.route_stops (route_id, stop_sequence);

-- Allow public (unauthenticated) document signing from customer portal
-- The server action verifies identity via order_number + email matching
CREATE POLICY "Portal users can update document status via signing"
  ON public.documents FOR UPDATE
  USING (true)
  WITH CHECK (document_status = 'signed');

-- ===== END 20260331_010000_innovative_features.sql =====

-- ===== BEGIN 20260401_010000_custom_domain_support.sql =====
-- Migration: Add custom domain support and slug constraints to organizations
-- The slug column already exists from the initial schema but needs validation constraints.
-- This migration adds custom domain columns and improves slug validation.

-- Add CHECK constraint for slug format (lowercase alphanumeric + hyphens, 3-63 chars, no leading/trailing hyphens)
alter table organizations
  add constraint organizations_slug_format_check
  check (slug ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$');

-- Add custom domain columns
alter table organizations
  add column if not exists custom_domain text unique,
  add column if not exists custom_domain_verified boolean not null default false;

-- Index for fast custom domain lookups
create unique index if not exists idx_organizations_custom_domain
  on organizations (custom_domain)
  where custom_domain is not null;

-- RLS: Allow anon/public users to read slug and custom_domain for routing resolution
create policy "Public can read org slug and domain"
  on organizations for select
  using (true);

-- RLS: Only org owners/admins can update slug and custom_domain
-- (Relies on existing membership-based RLS for update operations)

-- ===== END 20260401_010000_custom_domain_support.sql =====

-- ===== BEGIN 20260401_020000_bootstrap_organization_rpc.sql =====
-- bootstrap_organization RPC
-- Called by lib/onboarding/actions.ts during new-operator onboarding.
-- Creates the organization, assigns the authenticated user as owner,
-- seeds a default service area and starter product categories.
-- Returns the new organization's UUID.

create or replace function public.bootstrap_organization(
  p_business_name text,
  p_timezone text default 'America/New_York',
  p_zip_code text default null,
  p_delivery_fee numeric default 25,
  p_minimum_order numeric default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_slug text;
begin
  -- Require an authenticated caller
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate a temporary slug from the business name.
  -- The onboarding action will overwrite this with the user-chosen slug
  -- immediately after, but we need a value for the NOT NULL constraint.
  v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 3 then
    v_slug := v_slug || '-rentals';
  end if;
  -- Append random suffix to avoid unique constraint collisions
  v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create the organization
  insert into organizations (name, slug, timezone)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'))
  returning id into v_org_id;

  -- Add the caller as owner
  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  -- Seed a default service area if a ZIP was provided
  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  -- Seed starter product categories
  insert into categories (organization_id, name, slug, sort_order) values
    (v_org_id, 'Bounce House',  'bounce-house',  1),
    (v_org_id, 'Water Slide',   'water-slide',   2),
    (v_org_id, 'Combo Unit',    'combo-unit',     3),
    (v_org_id, 'Obstacle Course','obstacle-course',4),
    (v_org_id, 'Game',          'game',           5);

  return v_org_id;
end;
$$;

-- ===== END 20260401_020000_bootstrap_organization_rpc.sql =====

-- ===== BEGIN 20260402_010000_address_geocoding_columns.sql =====
-- Add latitude and longitude to customer_addresses for geocoding cache.
-- Route detail loads coordinates from here to plot delivery stops on the map.

alter table public.customer_addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.customer_addresses.latitude is 'Geocoded latitude, populated lazily from postal code via Nominatim';
comment on column public.customer_addresses.longitude is 'Geocoded longitude, populated lazily from postal code via Nominatim';

-- ===== END 20260402_010000_address_geocoding_columns.sql =====

-- ===== BEGIN 20260402_020000_messages_and_notifications.sql =====
-- ============================================================
-- Messages table for operator <-> customer communication
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  order_id UUID REFERENCES public.orders(id),
  customer_id UUID REFERENCES public.customers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('portal', 'dashboard', 'email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_org_order_created
  ON public.messages (organization_id, order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_org_unread
  ON public.messages (organization_id, read, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage messages"
  ON public.messages FOR ALL
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Portal (anon) can insert inbound messages
CREATE POLICY "Anon can insert inbound messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (direction = 'inbound');

-- ============================================================
-- Notifications table for persistent notification center
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_read_created
  ON public.notifications (organization_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view notifications"
  ON public.notifications FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org members can update notifications"
  ON public.notifications FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Allow inserts from any context (server actions insert on behalf of system)
CREATE POLICY "Allow notification inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- ===== END 20260402_020000_messages_and_notifications.sql =====

-- ===== BEGIN 20260402_030000_follow_up_tracking.sql =====
-- Add follow_up_sent_at to orders for tracking post-event follow-up emails
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;

-- Index for efficient cron queries on event_date + status
CREATE INDEX IF NOT EXISTS idx_orders_event_date_status
  ON public.orders (event_date, order_status)
  WHERE event_date IS NOT NULL;

-- ===== END 20260402_030000_follow_up_tracking.sql =====

-- ===== BEGIN 20260403_010000_availability_holds_expiration.sql =====
-- P0-3: Add expires_at column to availability_blocks for checkout hold expiration.
--
-- Checkout-initiated holds (block_type = 'checkout_hold') get a 30-minute expiration.
-- A cron job (/api/cron/cleanup-holds) runs every 15 minutes and deletes expired blocks.
-- When a Stripe payment webhook confirms payment, the block's expires_at is set to NULL
-- (converting it to a permanent reservation).
--
-- Dashboard-created blocks (order_hold, manual_hold, maintenance, etc.) have NULL expires_at
-- and are permanent until explicitly removed or the order is cancelled.

alter table public.availability_blocks
  add column if not exists expires_at timestamptz;

-- Index for efficient expired-hold cleanup queries
create index if not exists idx_availability_blocks_expires
  on availability_blocks (expires_at)
  where expires_at is not null;

-- Index for the availability check query that filters out expired blocks
create index if not exists idx_availability_blocks_org_product_window
  on availability_blocks (organization_id, product_id, starts_at, ends_at);

-- ===== END 20260403_010000_availability_holds_expiration.sql =====

-- ===== BEGIN 20260403_020000_p0_verification_fixes.sql =====
-- P0 verification fixes: webhook idempotency, subscription cancellation tracking

-- V2: Prevent duplicate Stripe payment records.
-- The webhook handler uses a SELECT-then-INSERT pattern which has a TOCTOU race window.
-- This partial unique index is the database-level last line of defense: if two concurrent
-- webhook deliveries both pass the app-level dedup check, the second INSERT will fail
-- rather than creating a duplicate payment row.
create unique index if not exists idx_payments_provider_payment_id_unique
  on payments (order_id, provider_payment_id)
  where provider_payment_id is not null;

-- V7: Store the actual subscription cancellation timestamp separately from updated_at.
-- updated_at is auto-set on ANY org row change (name, settings, etc.), so using it
-- as the grace-period baseline allows operators to accidentally extend the grace period
-- by editing any setting. subscription_canceled_at is only set by the webhook handler
-- when the subscription is actually deleted.
alter table public.organizations
  add column if not exists subscription_canceled_at timestamptz;

-- ===== END 20260403_020000_p0_verification_fixes.sql =====

-- ===== BEGIN 20260403_030000_backfill_balance_due_amount.sql =====
-- Backfill migration: Recompute balance_due_amount from the payments table
-- for all orders that have at least one payment record.
--
-- balance_due_amount is a cached field kept in sync by the application layer.
-- This migration fixes any stale values caused by payments recorded before the
-- computed-balance pattern was introduced.
--
-- Formula: balance = total_amount - (sum of non-refund payments) + (sum of refunds)

UPDATE orders o
SET balance_due_amount = o.total_amount - COALESCE(
  (
    SELECT
      SUM(CASE WHEN p.payment_type = 'refund' THEN -p.amount ELSE p.amount END)
    FROM payments p
    WHERE p.order_id = o.id
      AND p.payment_status = 'paid'
  ),
  0
)
WHERE EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = o.id
);

-- ===== END 20260403_030000_backfill_balance_due_amount.sql =====

-- ===== BEGIN 20260403_040000_document_signing_audit_trail.sql =====
-- Add audit trail columns for document signing.
-- signer_ip and signer_user_agent provide forensic evidence if a signature
-- is disputed. These columns are write-once (set at signing time).
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS signer_ip text,
ADD COLUMN IF NOT EXISTS signer_user_agent text;

-- ===== END 20260403_040000_document_signing_audit_trail.sql =====

-- ===== BEGIN 20260403_050000_communication_log.sql =====
-- Communication audit log: records every email, SMS, and portal message
-- so operators can see the complete history of customer touchpoints.

CREATE TABLE IF NOT EXISTS public.communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'portal_message', 'system')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  recipient TEXT,
  subject TEXT,
  body_preview TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching communications by order (order detail page)
CREATE INDEX IF NOT EXISTS idx_communication_log_org_order
  ON public.communication_log (organization_id, order_id, created_at DESC);

-- Index for fetching communications by customer (customer detail page)
CREATE INDEX IF NOT EXISTS idx_communication_log_org_customer
  ON public.communication_log (organization_id, customer_id, created_at DESC);

-- RLS: org members can read their own org's logs
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read communication_log"
  ON public.communication_log FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Allow inserts from any authenticated context (server actions, webhooks, cron)
CREATE POLICY "Authenticated can insert communication_log"
  ON public.communication_log FOR INSERT
  WITH CHECK (true);

-- ===== END 20260403_050000_communication_log.sql =====

-- ===== BEGIN 20260403_060000_terms_acceptance.sql =====
-- Add terms acceptance tracking to profiles and orders tables
-- Profiles: track when operators accept Terms of Service at signup
-- Orders: track when customers accept rental terms at checkout

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_ip inet;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- ===== END 20260403_060000_terms_acceptance.sql =====

-- ===== BEGIN 20260403_070000_organization_deleted_at.sql =====
-- Add soft-delete support for organizations (account deletion)
alter table public.organizations add column if not exists deleted_at timestamptz;

-- ===== END 20260403_070000_organization_deleted_at.sql =====

-- ===== BEGIN 20260404_010000_demo_org_flag.sql =====
-- Add is_demo flag to organizations for the public demo storefront.
-- Demo orgs are fully browseable but write-protected for public visitors.
alter table organizations add column if not exists is_demo boolean not null default false;

-- ===== END 20260404_010000_demo_org_flag.sql =====

-- ===== BEGIN 20260410_010000_portal_access_tokens.sql =====
-- Harden customer portal access with per-order tokenized links
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS portal_access_token_hash text,
  ADD COLUMN IF NOT EXISTS portal_access_token_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_portal_access_token_hash
  ON public.orders (portal_access_token_hash)
  WHERE portal_access_token_hash IS NOT NULL;

-- ===== END 20260410_010000_portal_access_tokens.sql =====

-- ===== BEGIN 20260413_010000_add_organizations_update_rls.sql =====
-- Fix: Add missing UPDATE RLS policy on the organizations table.
--
-- Without this policy every client-side UPDATE on organizations silently
-- returns 0 rows because RLS blocks the write.  This caused the slug
-- chosen during onboarding (and any later slug change from the domain-
-- settings panel) to be silently dropped, leaving the temporary RPC-
-- generated slug in place and producing 404s on the tenant storefront URL.

-- Guard: drop if it somehow already exists (idempotent re-run).
drop policy if exists "Org members can update their own organizations" on public.organizations;

create policy "Org members can update their own organizations"
  on public.organizations for update
  using (id in (select public.get_user_org_ids()));

-- ===== END 20260413_010000_add_organizations_update_rls.sql =====

-- ===== BEGIN 20260507_010000_customers_sms_opt_in.sql =====
-- Add SMS opt-in tracking to customers for TCPA compliance
alter table customers
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_ip text;

-- ===== END 20260507_010000_customers_sms_opt_in.sql =====

-- ===== BEGIN 20260507_020000_delivery_tracking.sql =====
-- Tracking token for customer-facing live delivery tracking page.
-- Lives on route_stops so each stop gets its own independent tracking link.
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS tracking_token_hash text,
  ADD COLUMN IF NOT EXISTS tracking_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_tracking_token_hash
  ON public.route_stops (tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

-- driver_locations: one row per active route, upserted on each GPS update.
-- Cleaned up automatically when the route is deleted (CASCADE).
CREATE TABLE IF NOT EXISTS public.driver_locations (
  route_id      uuid PRIMARY KEY REFERENCES public.routes(id) ON DELETE CASCADE,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  accuracy_m    double precision,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Authenticated org members can upsert their own route's location.
CREATE POLICY "Org members can upsert driver location"
  ON public.driver_locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon can read — the tracking page uses anon key and the token check prevents misuse.
-- The tracking API never exposes route_id directly from user input.
CREATE POLICY "Anon can read driver locations"
  ON public.driver_locations FOR SELECT
  TO anon
  USING (true);

-- ===== END 20260507_020000_delivery_tracking.sql =====

-- ===== BEGIN 20260507_030000_document_signature.sql =====
-- Add drawn signature storage to the documents table.
-- The signature_data_url stores a base64 PNG data URL captured via the portal
-- signature canvas; it is embedded in the generated document PDF.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;

-- ===== END 20260507_030000_document_signature.sql =====

-- ===== BEGIN 20260513_010000_multi_vertical_foundation.sql =====
-- Multi-vertical foundation
-- Adds fulfillment_type to orders, multi-day rental columns,
-- per-day rate tracking on order_items, and updates the bootstrap
-- RPC to seed vertical-appropriate starter categories.

-- ─── orders: fulfillment type ────────────────────────────────────────────────
alter table orders
  add column if not exists fulfillment_type text not null default 'delivery';

-- ─── orders: multi-day rental date range ─────────────────────────────────────
-- event_date stays for backward compat (inflatable = single event day).
-- rental_end_date is set for multi-day verticals (car, equipment).
alter table orders
  add column if not exists rental_end_date date;

-- ─── order_items: per-day pricing support ────────────────────────────────────
alter table order_items
  add column if not exists rental_days integer,
  add column if not exists rate_per_day numeric(10,2);

-- ─── bootstrap_organization: vertical-aware category seeding ─────────────────
create or replace function public.bootstrap_organization(
  p_business_name  text,
  p_timezone       text    default 'America/New_York',
  p_zip_code       text    default null,
  p_delivery_fee   numeric default 25,
  p_minimum_order  numeric default 100,
  p_business_type  text    default 'inflatable'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_slug    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug) < 3 then
    v_slug := v_slug || '-rentals';
  end if;
  v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into organizations (name, slug, timezone, business_type)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'), coalesce(p_business_type, 'inflatable'))
  returning id into v_org_id;

  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  -- Seed starter categories appropriate for the chosen vertical
  if coalesce(p_business_type, 'inflatable') = 'car' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Economy',     'economy',      1, 'car'),
      (v_org_id, 'SUV',         'suv',          2, 'car'),
      (v_org_id, 'Truck',       'truck',        3, 'car'),
      (v_org_id, 'Luxury',      'luxury',       4, 'car'),
      (v_org_id, 'Van',         'van',          5, 'car');

  elsif coalesce(p_business_type, 'inflatable') = 'equipment' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Generators',      'generators',       1, 'equipment'),
      (v_org_id, 'Lifts & Ladders', 'lifts-ladders',    2, 'equipment'),
      (v_org_id, 'Compressors',     'compressors',      3, 'equipment'),
      (v_org_id, 'Trailers',        'trailers',         4, 'equipment'),
      (v_org_id, 'Tools',           'tools',            5, 'equipment');

  else
    -- Default: inflatable / party rental
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Bounce House',   'bounce-house',   1, 'inflatable'),
      (v_org_id, 'Water Slide',    'water-slide',    2, 'inflatable'),
      (v_org_id, 'Combo Unit',     'combo-unit',     3, 'inflatable'),
      (v_org_id, 'Obstacle Course','obstacle-course',4, 'inflatable'),
      (v_org_id, 'Game',           'game',           5, 'inflatable');
  end if;

  return v_org_id;
end;
$$;

-- ===== END 20260513_010000_multi_vertical_foundation.sql =====

-- ===== BEGIN 20260513_020000_phase0_security.sql =====
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

-- ===== END 20260513_020000_phase0_security.sql =====

-- ===== BEGIN 20260513_030000_bootstrap_atomic_slug.sql =====
-- Make slug creation atomic in bootstrap_organization.
-- Previously the RPC generated a temp UUID slug, then the app ran a
-- separate UPDATE. If that UPDATE failed the org existed with an
-- unreadable slug. Now the caller passes the validated slug directly
-- and it is set in the same INSERT transaction.

create or replace function public.bootstrap_organization(
  p_business_name  text,
  p_slug           text    default null,
  p_timezone       text    default 'America/New_York',
  p_zip_code       text    default null,
  p_delivery_fee   numeric default 25,
  p_minimum_order  numeric default 100,
  p_business_type  text    default 'inflatable'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_slug    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Use caller-supplied slug when provided, otherwise generate a
  -- collision-safe temp slug (UUID suffix) as a fallback.
  if p_slug is not null and p_slug <> '' then
    v_slug := p_slug;
  else
    v_slug := lower(regexp_replace(trim(p_business_name), '[^a-z0-9]+', '-', 'gi'));
    v_slug := trim(both '-' from v_slug);
    if length(v_slug) < 3 then
      v_slug := v_slug || '-rentals';
    end if;
    v_slug := left(v_slug, 54) || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  insert into organizations (name, slug, timezone, business_type)
  values (p_business_name, v_slug, coalesce(p_timezone, 'America/New_York'), coalesce(p_business_type, 'inflatable'))
  returning id into v_org_id;

  insert into organization_memberships (organization_id, profile_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  if p_zip_code is not null and p_zip_code <> '' then
    insert into service_areas (organization_id, label, zip_code, delivery_fee, minimum_order_amount)
    values (v_org_id, 'Primary area', p_zip_code, coalesce(p_delivery_fee, 25), coalesce(p_minimum_order, 100));
  end if;

  if coalesce(p_business_type, 'inflatable') = 'car' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Economy',     'economy',   1, 'car'),
      (v_org_id, 'SUV',         'suv',       2, 'car'),
      (v_org_id, 'Truck',       'truck',     3, 'car'),
      (v_org_id, 'Luxury',      'luxury',    4, 'car'),
      (v_org_id, 'Van',         'van',       5, 'car');

  elsif coalesce(p_business_type, 'inflatable') = 'equipment' then
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Generators',      'generators',    1, 'equipment'),
      (v_org_id, 'Lifts & Ladders', 'lifts-ladders', 2, 'equipment'),
      (v_org_id, 'Compressors',     'compressors',   3, 'equipment'),
      (v_org_id, 'Trailers',        'trailers',      4, 'equipment'),
      (v_org_id, 'Tools',           'tools',         5, 'equipment');

  else
    insert into categories (organization_id, name, slug, sort_order, vertical) values
      (v_org_id, 'Bounce House',    'bounce-house',    1, 'inflatable'),
      (v_org_id, 'Water Slide',     'water-slide',     2, 'inflatable'),
      (v_org_id, 'Combo Unit',      'combo-unit',      3, 'inflatable'),
      (v_org_id, 'Obstacle Course', 'obstacle-course', 4, 'inflatable'),
      (v_org_id, 'Game',            'game',            5, 'inflatable');
  end if;

  return v_org_id;
end;
$$;

-- ===== END 20260513_030000_bootstrap_atomic_slug.sql =====

-- ===== BEGIN 20260513_040000_review_fixes.sql =====
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

-- ===== END 20260513_040000_review_fixes.sql =====

-- ===== BEGIN 20260514_010000_order_delivery_metadata.sql =====
-- Add delivery metadata columns to orders table.
-- These fields capture site-specific delivery info collected at order creation:
-- surface type (determines anchoring), gate code (crew access), on-site contact,
-- and setup notes (hazards, HOA restrictions, power access, etc.).

alter table public.orders
  add column if not exists delivery_surface_type text
    check (delivery_surface_type in ('grass', 'concrete', 'asphalt', 'other')),
  add column if not exists delivery_gate_code text,
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_phone text,
  add column if not exists delivery_setup_notes text;

comment on column public.orders.delivery_surface_type is 'Setup surface: grass, concrete, asphalt, or other. Determines anchoring method.';
comment on column public.orders.delivery_gate_code is 'Gate or access code for the delivery location.';
comment on column public.orders.delivery_contact_name is 'On-site contact name (may differ from account holder).';
comment on column public.orders.delivery_contact_phone is 'On-site contact phone number.';
comment on column public.orders.delivery_setup_notes is 'Crew-facing setup notes: hazards, HOA rules, power access, slopes, etc.';

-- ===== END 20260514_010000_order_delivery_metadata.sql =====

-- ===== BEGIN 20260514_020000_atomic_availability_reserve.sql =====
-- Atomic availability check + reserve function.
--
-- Eliminates the TOCTOU race between checking capacity and inserting a block.
-- Uses pg_advisory_xact_lock keyed on (organization_id, product_id) so concurrent
-- requests for the same item on the same org are serialized for the duration of
-- the transaction. Requests for different items or orgs run in parallel.

CREATE OR REPLACE FUNCTION public.reserve_availability_if_available(
  p_organization_id  uuid,
  p_product_id       uuid,
  p_block_type       text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_reason           text,
  p_source_order_id  uuid,
  p_expires_at       timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_capacity  integer;
  v_reserved_count  integer;
BEGIN
  -- Advisory lock: hash the two UUIDs into a stable bigint.
  -- Serializes all concurrent reserve attempts for the same org+product.
  PERFORM pg_advisory_xact_lock(
    ('x' || left(md5(p_organization_id::text || ':' || p_product_id::text), 16))::bit(64)::bigint
  );

  -- Count physical assets available for booking
  SELECT count(*) INTO v_asset_capacity
  FROM public.assets
  WHERE organization_id = p_organization_id
    AND product_id      = p_product_id
    AND operational_status IN ('ready', 'available', 'active');

  IF v_asset_capacity = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This item is not currently available for booking.'
    );
  END IF;

  -- Count overlapping non-expired blocks
  SELECT count(*) INTO v_reserved_count
  FROM public.availability_blocks
  WHERE organization_id = p_organization_id
    AND product_id      = p_product_id
    AND starts_at       < p_ends_at
    AND ends_at         > p_starts_at
    AND (expires_at IS NULL OR expires_at > now());

  IF v_reserved_count >= v_asset_capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'This rental is already reserved for the selected date.'
    );
  END IF;

  -- Safe to insert — still inside the advisory lock
  INSERT INTO public.availability_blocks (
    organization_id, product_id, block_type,
    starts_at, ends_at, reason, source_order_id, expires_at
  ) VALUES (
    p_organization_id, p_product_id, p_block_type,
    p_starts_at, p_ends_at, p_reason, p_source_order_id, p_expires_at
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_availability_if_available(
  uuid, uuid, text, timestamptz, timestamptz, text, uuid, timestamptz
) TO authenticated, service_role;

-- ===== END 20260514_020000_atomic_availability_reserve.sql =====

-- ===== BEGIN 20260515_010000_fix_multitenant_checkout_rls.sql =====
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

-- ===== END 20260515_010000_fix_multitenant_checkout_rls.sql =====

-- ===== BEGIN 20260515_020000_data_integrity_constraints.sql =====
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

-- ===== END 20260515_020000_data_integrity_constraints.sql =====

-- ===== BEGIN 20260515_030000_atomic_payment_recording.sql =====
-- Atomic manual payment recording to prevent race conditions.
--
-- Two staff members simultaneously recording a payment for the same order would
-- both pass the JS-layer balance check (TOCTOU), leading to over-payment.
-- This function uses SELECT FOR UPDATE to lock the order row during validation
-- so only one payment insertion proceeds at a time.
--
-- Returns: { ok: boolean, message?: text, payment_id?: uuid, new_balance?: numeric }

create or replace function record_manual_payment(
  p_order_id       uuid,
  p_org_id         uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_payment_method text,
  p_reference_note text default null,
  p_paid_at        timestamptz default now()
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       record;
  v_total_paid  numeric;
  v_total_ref   numeric;
  v_net_paid    numeric;
  v_balance     numeric;
  v_new_id      uuid;
  v_new_balance numeric;
begin
  -- Lock the order row to serialize concurrent payment inserts
  select id, total_amount, order_status, organization_id
    into v_order
    from orders
   where id = p_order_id
     and organization_id = p_org_id
     for update;

  if not found then
    return json_build_object('ok', false, 'message', 'Order not found or access denied.');
  end if;

  -- Compute authoritative financial state inside the lock
  select
    coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0),
    coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    into v_total_paid, v_total_ref
    from payments
   where order_id = p_order_id
     and payment_status = 'paid';

  v_net_paid := greatest(0, v_total_paid - v_total_ref);
  v_balance  := greatest(0, coalesce(v_order.total_amount, 0) - v_net_paid);

  -- Validate
  if p_payment_type != 'refund' and p_amount > v_balance then
    return json_build_object(
      'ok', false,
      'message', format(
        'Payment amount ($%s) exceeds outstanding balance ($%s).',
        to_char(p_amount, 'FM99999990.00'),
        to_char(v_balance, 'FM99999990.00')
      )
    );
  end if;

  if p_payment_type = 'refund' and p_amount > v_total_paid then
    return json_build_object(
      'ok', false,
      'message', format(
        'Refund ($%s) exceeds total payments received ($%s).',
        to_char(p_amount, 'FM99999990.00'),
        to_char(v_total_paid, 'FM99999990.00')
      )
    );
  end if;

  -- Insert payment record
  insert into payments (
    order_id, provider, payment_type, payment_status,
    amount, payment_method, reference_note, paid_at
  ) values (
    p_order_id, 'manual', p_payment_type, 'paid',
    p_amount, p_payment_method, p_reference_note, p_paid_at
  )
  returning id into v_new_id;

  -- Recompute and cache new balance
  select greatest(0, coalesce(v_order.total_amount, 0) -
    greatest(0,
      coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0) -
      coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    ))
    into v_new_balance
    from payments
   where order_id = p_order_id and payment_status = 'paid';

  update orders
     set balance_due_amount = v_new_balance
   where id = p_order_id;

  return json_build_object(
    'ok',          true,
    'payment_id',  v_new_id,
    'new_balance', v_new_balance,
    'net_paid',    v_net_paid + (case when p_payment_type != 'refund' then p_amount else -p_amount end)
  );
end;
$$;

-- ===== END 20260515_030000_atomic_payment_recording.sql =====

-- ===== BEGIN 20260515_040000_org_membership_rls.sql =====
-- Add missing UPDATE and DELETE RLS policies on organization_memberships.
--
-- INSERT policy existed but UPDATE/DELETE were absent, relying solely on
-- application-layer checks. Defense-in-depth requires RLS for all mutation ops.
--
-- Rules:
--   UPDATE — only owners/admins of the organization can change roles/status
--   DELETE — only owners/admins of the organization can remove members
--
-- Both policies allow a member to update/delete their OWN row so that
-- self-removal (leave org) works without requiring elevated role.

create policy "Members can be updated by org owners/admins or themselves"
  on organization_memberships
  for update
  using (
    -- The acting user is an owner or admin of this org
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
    -- OR the user is updating their own membership (e.g., changing settings)
    or profile_id = auth.uid()
  );

create policy "Members can be deleted by org owners/admins or themselves"
  on organization_memberships
  for delete
  using (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
    or profile_id = auth.uid()
  );

-- ===== END 20260515_040000_org_membership_rls.sql =====

-- ===== BEGIN 20260515_050000_atomic_setup_step.sql =====
-- Atomic setup progress flag update to prevent lost updates.
--
-- The JS-level markSetupStep() used a read-modify-write on organizations.settings
-- (read → merge in memory → write back). Concurrent calls from different server
-- actions (product creation + service area creation at the same time) caused
-- the second write to overwrite the first, losing a setup flag.
--
-- This function uses jsonb_set() inside a single UPDATE statement so the merge
-- happens atomically inside Postgres — no lost-update race is possible.

create or replace function mark_org_setup_step(p_org_id uuid, p_step text)
returns void
language sql
security definer
set search_path = public
as $$
  update organizations
  set settings = jsonb_set(
    jsonb_set(
      coalesce(settings::jsonb, '{}'),
      '{setup_progress}',
      coalesce((settings::jsonb -> 'setup_progress'), '{}')
    ),
    array['setup_progress', p_step],
    'true'::jsonb
  )
  where id = p_org_id;
$$;

-- ===== END 20260515_050000_atomic_setup_step.sql =====

-- ===== BEGIN 20260515_060000_service_areas_rls_deleted_at.sql =====
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

-- ===== END 20260515_060000_service_areas_rls_deleted_at.sql =====

