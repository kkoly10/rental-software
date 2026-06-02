-- security: hide stripe + subscription columns from anon. The
-- "Anon can view organizations for public storefront" policy returned
-- whole rows including stripe_customer_id, stripe_subscription_id,
-- subscription_status/plan/period_end/canceled_at. Anon-context paths
-- in this codebase only select (settings, name, slug, id, custom_domain*,
-- business_type, etc.), so revoking SELECT on the billing columns is
-- safe and surgical. Authenticated dashboard + service_role (Stripe
-- webhooks) keep full access.
--
-- NOTE: this column-level REVOKE is a no-op when anon also holds a
-- table-level SELECT (which Supabase grants by default) — the
-- table-level grant overrides column-level revokes. Superseded by
-- 20260601_041000 which REVOKEs the table-level grant and GRANTs an
-- explicit safe column set.
revoke select (
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  subscription_plan,
  subscription_current_period_end,
  subscription_canceled_at
) on public.organizations from anon;
