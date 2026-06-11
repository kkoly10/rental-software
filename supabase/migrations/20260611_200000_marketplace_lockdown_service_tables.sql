-- Defense-in-depth (from the live security-advisor pass after applying
-- the marketplace schema): the six service-role-only marketplace tables
-- rely on RLS-with-no-policies to deny client reads — sound, but the
-- default PostgREST grants still expose their names in the GraphQL
-- schema and leave a needless blast radius if a future policy lands by
-- mistake. Revoke the client grants outright; the service role keeps
-- full access (it bypasses both grants here and RLS).
--
-- Deliberately NOT touched: market tables WITH read policies (listings,
-- reviews, seller profiles, bookings, ...) need their grants for
-- PostgREST policy-gated reads.

revoke all on table public.market_world_waitlist     from anon, authenticated;
revoke all on table public.market_demand_events      from anon, authenticated;
revoke all on table public.market_phone_otp          from anon, authenticated;
revoke all on table public.market_stripe_webhook_events from anon, authenticated;
revoke all on table public.market_bridge_outbox      from anon, authenticated;
revoke all on table public.market_chargebacks        from anon, authenticated;
