-- Sprint 1.5 — Smart Delivery Mode (Option C)
--
-- Adds a per-org `routing_mode` switch that controls whether the
-- system auto-creates and auto-bundles delivery routes when orders
-- are confirmed. Replaces the boolean `settings.auto_route_on_confirm`
-- kill switch with a more explicit two-value column.
--
-- Migration semantics for EXISTING orgs:
--   - Any org that has ever created a route is pinned to 'manual' so
--     its existing workflow is preserved on deploy.
--   - Any org that previously set `settings.auto_route_on_confirm = false`
--     is also pinned to 'manual' (they explicitly opted out before).
--   - Everyone else lands on 'auto'.
--
-- Also performs the one-time zombie cleanup: past-dated routes in the
-- `planned` status with zero stops are deleted. These rows accumulate
-- when an operator removes the last stop from a route or cancels every
-- order on it. Going forward, the application code keeps them from
-- forming (lib/routes/actions.ts last-stop guard).

alter table organizations
  add column if not exists routing_mode text not null default 'auto'
  check (routing_mode in ('auto', 'manual'));

-- Pin to 'manual' for orgs that already have routes — preserves their
-- current workflow on deploy. Brand-new orgs default to 'auto' via the
-- column default above.
update organizations
   set routing_mode = 'manual'
 where exists (
   select 1
     from routes
    where routes.organization_id = organizations.id
 );

-- Also honor the legacy kill-switch from `settings.auto_route_on_confirm`.
-- Operators who explicitly disabled auto-attach get the same manual
-- behavior under the new model.
update organizations
   set routing_mode = 'manual'
 where settings->>'auto_route_on_confirm' = 'false'
   and routing_mode = 'auto';

-- One-time zombie cleanup. Only past-dated planned routes with no
-- stops are unambiguous garbage; future-dated empty routes are left
-- alone in case the operator is still setting them up.
delete from routes
 where route_status = 'planned'
   and route_date < current_date
   and not exists (
     select 1 from route_stops where route_stops.route_id = routes.id
   );

comment on column organizations.routing_mode is
  'Smart Delivery Mode setting. ''auto'' = system auto-creates and auto-bundles routes when orders are confirmed (default for new orgs). ''manual'' = operator creates routes by hand (legacy behavior, pinned for orgs that already had routes at migration time).';
