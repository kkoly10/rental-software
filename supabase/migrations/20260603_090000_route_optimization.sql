-- Sprint 5 — Route auto-optimization
--
-- One-click route ordering against an external optimizer (Mapbox
-- Optimization v2 in the MVP; the wrapper at
-- lib/logistics/route-optimizer.ts is provider-agnostic so swapping
-- in Google Routes later is a single-file change).
--
-- We persist the optimizer's distance + duration estimates alongside
-- a timestamp so the route detail page can render
-- "Optimized 2h ago — 47 mi, 1h 38m" without re-charging Mapbox on
-- every page view. The cache is invalidated implicitly when stops
-- change — the next call to the optimizer always sees the current
-- stop list, so a stale estimate only persists until the operator
-- clicks Optimize again.

alter table routes
  add column if not exists last_optimized_at timestamptz,
  add column if not exists optimization_distance_meters integer,
  add column if not exists optimization_duration_seconds integer,
  add column if not exists optimization_provider text;

comment on column routes.last_optimized_at is
  'When the operator most recently ran auto-optimization on this route. NULL means the route was sequenced by hand or by the Smart Delivery Mode time-based sort.';
comment on column routes.optimization_distance_meters is
  'Optimizer-reported total drive distance for the route at the last_optimized_at moment. Used to render the savings summary on the route detail page.';
comment on column routes.optimization_duration_seconds is
  'Optimizer-reported total drive time. Same caveat as distance.';
comment on column routes.optimization_provider is
  'Which optimizer produced last_optimized_at''s result ("mapbox" / "google_routes" / future providers). Lets us A/B test or migrate without losing history.';
