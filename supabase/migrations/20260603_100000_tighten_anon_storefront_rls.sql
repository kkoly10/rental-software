-- Sprint 5.9 — Tighten anonymous storefront RLS to prevent cross-tenant reads.
--
-- Background:
--   Six anon SELECT policies in 20260325_010000 / 20260515_060000 filter only
--   by `is_active` or `visibility = 'public'`, not by `organization_id`. With
--   the public NEXT_PUBLIC_SUPABASE_ANON_KEY (which ships in the browser
--   bundle), anyone could hit Supabase's REST endpoint directly and enumerate
--   every tenant's catalog. Validation confirmed: anon could read products,
--   categories, service_areas, and product_images from all 4 orgs in the DB.
--
--   The app itself escapes this by using the service_role admin client for
--   storefront reads (which bypasses RLS), but that doesn't help against a
--   direct attacker using the public anon key.
--
--   Separately, `get_public_org_id()` was returning "the oldest organization
--   globally" — a stop-gap that made anonymous checkout work only for the
--   first org ever created. The TypeScript-side `getPublicOrgId()` in
--   lib/auth/org-context.ts already resolves the storefront org from the
--   request host header. This migration brings the SQL function in line with
--   that, by reading an `x-storefront-slug` header from the PostgREST
--   request-headers GUC.
--
-- Behavior after this migration:
--   - Anon SELECT on organizations/products/categories/service_areas/
--     product_images/product_attributes requires the request to set the
--     `x-storefront-slug` header. Without it, anon sees zero rows on those
--     tables — which is the desired default for any external REST call.
--   - The app's existing service_role paths are unaffected (service_role
--     bypasses RLS).
--   - Anon INSERT on customers/orders/order_items/customer_addresses now
--     correctly scopes to the storefront's org (via `get_public_org_id()`),
--     so anonymous checkout works for every tenant, not just the oldest one.
--
-- Migration safety:
--   - Drops and recreates each anon policy explicitly so we know the final
--     state. The non-anon "Org members can manage X" policies are untouched.
--   - The function rewrite is backward-compatible for callers that don't set
--     a header: it returns NULL, which is the safe default (anon access
--     denied) and matches the intent of every policy that uses it.

-- 1. Replace get_public_org_id() with header-based resolution.
--    SECURITY DEFINER + STABLE so it can be inlined inside RLS policies
--    without losing the search_path lockdown.

create or replace function public.get_public_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
    from public.organizations
   where deleted_at is null
     and slug = lower(nullif(
       current_setting('request.headers', true)::json ->> 'x-storefront-slug',
       ''
     ))
   limit 1
$$;

comment on function public.get_public_org_id() is
  'Resolves the storefront org for an anonymous request. Reads the x-storefront-slug header from PostgREST''s request.headers GUC. Returns NULL when no header is set or the slug does not match any non-deleted org, which denies anon access by default for every RLS policy that references this function.';

-- 2. Tighten anon SELECT policies on the 5 leaky tables.

-- organizations: anon can only find an org by setting the slug header.
-- Prevents enumeration of every tenant via `select * from organizations`.
drop policy if exists "Anon can view organizations for public storefront"
  on public.organizations;
create policy "Anon can view organizations for public storefront"
  on public.organizations
  for select to anon
  using (
    deleted_at is null
    and slug = lower(nullif(
      current_setting('request.headers', true)::json ->> 'x-storefront-slug',
      ''
    ))
  );

-- service_areas: scope to the storefront org.
drop policy if exists "Anon can view service areas" on public.service_areas;
create policy "Anon can view service areas"
  on public.service_areas
  for select to anon
  using (
    is_active = true
    and deleted_at is null
    and organization_id = public.get_public_org_id()
  );

-- categories: scope to the storefront org.
drop policy if exists "Anon can view active categories" on public.categories;
create policy "Anon can view active categories"
  on public.categories
  for select to anon
  using (
    is_active = true
    and organization_id = public.get_public_org_id()
  );

-- products: scope to the storefront org.
drop policy if exists "Anon can view public active products" on public.products;
create policy "Anon can view public active products"
  on public.products
  for select to anon
  using (
    is_active = true
    and visibility = 'public'
    and organization_id = public.get_public_org_id()
  );

-- product_images: scope by parent product's org.
drop policy if exists "Anon can view images of public active products"
  on public.product_images;
create policy "Anon can view images of public active products"
  on public.product_images
  for select to anon
  using (
    deleted_at is null
    and product_id in (
      select id from public.products
       where is_active = true
         and visibility = 'public'
         and organization_id = public.get_public_org_id()
    )
  );

-- product_attributes: scope by parent product's org.
drop policy if exists "Anon can view attributes of public active products"
  on public.product_attributes;
create policy "Anon can view attributes of public active products"
  on public.product_attributes
  for select to anon
  using (
    product_id in (
      select id from public.products
       where is_active = true
         and visibility = 'public'
         and organization_id = public.get_public_org_id()
    )
  );
