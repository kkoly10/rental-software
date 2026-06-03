# Route Auto-Optimization (Sprint 5)

## Why this exists

Goodshuffle Pro and InflatableOffice both ship one-click route optimizers. Korent's manual sequencing left a real "how do I order my Saturday deliveries?" pain point for any operator with 4+ stops. Sprint 5 closes the gap and adds the last P1 feature from the master plan.

## Provider choice

Picked **Mapbox Optimization v2** ($2 per 1,000 requests, 50k/mo free tier) over Google Routes (~$5 per 1,000) for the MVP. The architecture is provider-agnostic — see the `RouteOptimizerProvider` interface — so swapping in Google or adding a second provider per-org is a single-file change.

## Architecture

Two-layer split keeps the testable logic separate from the network code:

1. **Pure orchestration** (`lib/logistics/route-optimizer.ts`):
   - Partitions stops into locked / optimizable / unoptimizable
   - Hands the optimizable subset to the provider
   - Concatenates `[locked-in-sequence, provider-ordered, unoptimized-tail]`
   - All synchronous code paths — no fetch, no Supabase — unit-tested via fake provider (6 tests covering every branch)

2. **Provider adapters** (`lib/logistics/optimizers/mapbox.ts`):
   - Mapbox-specific request/response shape
   - Submit + poll dance (Mapbox v2 is async; we poll for up to 8s)
   - Maps Mapbox errors to typed `OptimizerProviderResult` reasons

3. **Server action** (`lib/logistics/optimize-route-action.ts`):
   - Loads the route + stops, validates role + status, runs the orchestration
   - Two-pass renumber respects the `(route_id, stop_sequence)` unique index
   - Persists the distance/duration summary to `routes` so subsequent page loads don't re-call Mapbox

## Stop categories

```
status='completed' / 'skipped' / 'en_route'
   ↓ locked — keep at head of the route in original sequence
status='pending' with lat+lng
   ↓ optimizable — sent to Mapbox
status='pending' without lat+lng
   ↓ unoptimizable — kept at the tail
```

The `unoptimizedStopIds` count is surfaced to the operator after the click so they know which addresses need geocoding to participate next time.

## Cost guard

Mapbox is throttled at the API level (rate_limited → typed error). The action also short-circuits when fewer than 2 stops are optimizable — a single-stop route has no permutation to choose, so we skip the network call entirely.

A 50-route/month operator costs roughly $0.10/mo on the paid tier. Effectively free under the 50k free tier.

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_090000_route_optimization.sql` | `routes.last_optimized_at`, `optimization_distance_meters`, `optimization_duration_seconds`, `optimization_provider` |
| `lib/logistics/route-optimizer.ts` | Pure orchestration + `RouteOptimizerProvider` interface |
| `lib/logistics/optimizers/mapbox.ts` | Mapbox Optimization v2 adapter (submit + poll) |
| `lib/logistics/optimize-route-action.ts` | `optimizeRoute` server action (owner/admin/dispatcher only) |
| `components/deliveries/optimize-route-button.tsx` | Button on the route detail page |
| `app/dashboard/deliveries/[id]/page.tsx` (modified) | Mounts the button |
| `tests/route-optimizer.test.ts` | 6 unit tests pinning the decision tree |
| `.env.example` (modified) | `MAPBOX_ACCESS_TOKEN` documented |

## Deferred to Sprint 5.5

- **Persistent optimization summary on the route detail page.** Right now the operator sees the distance/time in the action toast that fires after clicking. The persistent display requires extending `getRouteDetailEnhanced` to load the new columns and rendering a card. Small lift.
- **Time-window constraints.** Mapbox supports per-stop `service_windows`. Wiring this would let "deliver before 10am" honor the existing `scheduled_window_start` instead of treating it as informational only.
- **Gas + labor cost summary.** The master plan calls this out optional. `distance × fuel_price + duration × driver_wage` is straightforward once an org has those settings. Sprint 5.7.
- **A/B comparing optimizers.** The `optimization_provider` column is recorded for this purpose; the actual switch + comparison report is future work.
