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
