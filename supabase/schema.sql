create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'inflatable',
  timezone text not null default 'America/New_York',
  default_currency text not null default 'USD',
  is_demo boolean not null default false,
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
