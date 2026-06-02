-- security: properly hide stripe + subscription columns from anon.
--
-- 20260601_040000 attempted REVOKE SELECT (cols) FROM anon, but anon
-- holds a TABLE-level SELECT on public.organizations (granted by
-- Supabase defaults), and table-level grants override column-level
-- revokes in Postgres — so the previous migration was a no-op.
--
-- The correct pattern is: REVOKE the table-level SELECT, then GRANT
-- back only the columns anon is allowed to read. Storefront anon paths
-- in this codebase read:
--   - lib/data/brand.ts            → settings
--   - lib/data/theme-settings.ts   → settings
--   - lib/data/organization-settings.ts → settings, name, support_email, phone
--   - lib/auth/resolve-org.ts      → id, slug, custom_domain, custom_domain_verified, deleted_at
--   - app/manifest.ts / app/layout / app/opengraph-image → getBrandSettings (settings)
--
-- Excluded from anon SELECT (kept for authenticated / service_role):
--   stripe_customer_id, stripe_subscription_id,
--   subscription_status, subscription_plan,
--   subscription_current_period_end, subscription_canceled_at

revoke select on public.organizations from anon;

grant select (
  id,
  name,
  slug,
  business_type,
  timezone,
  default_currency,
  settings,
  support_email,
  phone,
  custom_domain,
  custom_domain_verified,
  is_demo,
  deleted_at,
  created_at,
  updated_at
) on public.organizations to anon;
