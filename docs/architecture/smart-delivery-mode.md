# Smart Delivery Mode (Sprint 1.5)

## Why this exists

A recon of the delivery flow surfaced a 3-click ritual for noob operators with 1 confirmed order:
1. Open `/dashboard/deliveries`, fill the "Create a Route" form
2. Navigate to the new route's detail page, scroll to the "Add Stop" form
3. Pick the order, click Add Stop, then click Start Route

The "route" concept is load-bearing for multi-stop dispatch but dead weight for single-order days. ~80-90% of US/Mexico party rental operators are not on any rental SaaS today (see `docs/strategy/01-market-analysis.md`), so the median Korent buyer has never used the word "route" professionally.

Smart Delivery Mode collapses the ritual into a 1-click "Send delivery" per order, while preserving the manual route abstraction for the small minority of power users who want it.

## Two routing modes

The `organizations.routing_mode` column controls behavior org-wide:

- **`auto`** (default for new orgs): Korent auto-creates routes when orders are confirmed, auto-bundles same-day orders, and auto-sequences stops by event time. Per-order "Send delivery" button dispatches with one click.
- **`manual`** (pinned for orgs that already had routes at migration time): legacy behavior. Operator creates routes by hand, adds stops, and starts each route.

The migration (`20260603_010000_smart_delivery_mode.sql`) pre-flips orgs to `manual` if they have ANY existing routes — this preserves their workflow on deploy. New orgs land on `auto`. Operators can toggle via Settings → Smart Delivery Mode.

The legacy `settings.auto_route_on_confirm = false` kill switch is also honored as `manual` for safety, in case the migration somehow missed an org.

## The auto-attach algorithm

`lib/routes/auto-attach.ts::autoAttachOrderToRouteIfEligible` runs when an order moves to `confirmed` or `scheduled` (via `lib/orders/actions.ts::createOrder` or `::updateOrderStatus`).

Logic:
1. Read `organizations.routing_mode`. If `manual` (or the legacy kill switch is set), restrict behavior to the pre-Sprint-1.5 case (attach only when exactly one route already exists).
2. Verify the order has `event_date` and `delivery_line1`. Skip otherwise.
3. Check the order isn't already a stop on any route.
4. Query routes for that org+date:
   - **0 routes, auto mode**: CREATE a route named "Deliveries for {date}" with no driver/vehicle, status `planned`. Then attach.
   - **0 routes, manual mode**: bail with `reason: "no_route"`. (Operator creates manually.)
   - **1 route, either mode**: attach to it.
   - **2+ routes, either mode**: bail with `reason: "ambiguous"`. The AssignToRouteCard on the order detail page lets the operator pick.
5. Insert the stop via the `add_stop_to_route` RPC (preserves the (route_id, stop_sequence) unique-index serialization that prevents the count-then-insert race).
6. Re-sequence ALL stops on the route by `scheduled_window_start` so the loading order matches the day's schedule. Stops missing a start time sort to the end; tiebreak by stop id.

The result type now carries `created: boolean` so callers can distinguish "added to existing route" from "auto-scheduled on new route" in their success message.

## Re-sequencing detail (the two-pass trick)

The `(route_id, stop_sequence)` unique index means we can't bulk-renumber in one pass — intermediate UPDATEs would collide. The implementation does two passes:

1. **Pass 1**: park every stop at `1000 + idx + 1` (a high-numbered band disjoint from any plausible final value).
2. **Pass 2**: write the final `idx + 1` sequence numbers in order.

If pass 1 succeeds and pass 2 partially fails, you get stops temporarily numbered in the 1000s. Subsequent auto-attach runs will re-sequence them correctly. No data is lost.

## The atomic dispatch RPC

`dispatch_order_delivery` (in `20260603_020000_dispatch_order_delivery_rpc.sql`) flips three states in a single transaction:
1. Stop: `pending` → `en_route`
2. Route: `planned` → `in_progress` (idempotent if already in flight)
3. Order: `confirmed`/`scheduled` → `out_for_delivery`

Authorization: owner/admin/dispatcher only. Anyone else gets `not_authorized`.

The RPC takes `FOR UPDATE` on the parent route row so a concurrent route-status change can't race the three updates. If we did these in three separate app-layer queries, a database failure mid-way would leave the system showing the order as "out for delivery" while the stop was still "pending" — a real UX corruption surface.

Wrapper: `lib/routes/dispatch.ts::dispatchOrderDelivery`. UI: `components/orders/send-delivery-button.tsx`.

## Cancellation chain (kills zombie routes)

`lib/routes/remove-stop-on-cancel.ts::removeOrderStopOnCancel` runs from `updateOrderStatus` when an order moves to `cancelled`. It delegates to the `remove_order_stop_on_cancel` Postgres RPC (migration `20260603_030000`) which, inside a single transaction with a `FOR UPDATE` lock on the parent route, does:

1. Finds the order's stop and locks the parent route.
2. Verifies org ownership (`routes.organization_id = p_org_id`).
3. Deletes the stop.
4. Re-sequences remaining stops via `row_number() OVER (...)` so a concurrent reader can't observe a gap.
5. If the route is now empty AND `route_status = 'planned'`, deletes the route too.
6. Returns `{ ok, reason, removed, route_deleted, route_id }` so the wrapper can revalidate the affected dashboard paths.

The row lock closes the race window the first cut had: a concurrent `auto-attach` insert was previously able to slip in a new stop between the count and the route delete, leaving a route with a stop on it.

Applies in BOTH auto and manual mode — keeping a stop for a non-event is bookkeeping garbage either way, and the count/list mismatch (cancelled-order stops are filtered out of the route detail render but still counted in `route_stops`) is a real bug regardless of routing philosophy.

`refunded` is intentionally NOT in the chain because refunds happen on already-delivered orders (e.g., damage refunds), and tearing down a stop on a mid-delivery route would confuse the crew.

## Zombie cleanup (one-time + going-forward)

**One-time**: the migration deletes past-dated `planned` routes with zero stops. Future-dated empty routes are preserved (operator might still be setting them up).

**Going-forward**: `lib/routes/actions.ts::removeStopFromRoute` always deletes the parent route when removing the last stop and the route is still `planned`. This was previously gated to "the route never had stops"; Sprint 1.5 broadens it because the new auto-create model means empty `planned` routes are always garbage.

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_010000_smart_delivery_mode.sql` | Schema + backfill + zombie cleanup |
| `supabase/migrations/20260603_020000_dispatch_order_delivery_rpc.sql` | Atomic dispatch RPC (with `already_dispatched` / `already_completed` / `invalid_state` distinctions) |
| `supabase/migrations/20260603_030000_remove_order_stop_on_cancel_rpc.sql` | Atomic cancellation cleanup RPC |
| `lib/routes/auto-attach.ts` | Auto-create + auto-bundle + auto-sequence |
| `lib/routes/dispatch.ts` | `dispatchOrderDelivery` server action |
| `lib/routes/remove-stop-on-cancel.ts` | RPC wrapper for the cancellation chain |
| `lib/routes/send-en-route-sms.ts` | Shared SMS + tracking-link helper |
| `lib/routes/actions.ts` (modified) | Empty-route cleanup on last-stop removal |
| `lib/orders/actions.ts` (modified) | Cancellation chain wiring + auto-attach result handling |
| `lib/settings/actions.ts` (modified) | `updateRoutingMode` toggle |
| `lib/data/routing-mode.ts` | Fetcher for the org's current mode |
| `components/settings/routing-mode-form.tsx` | Settings → Advanced toggle UI |
| `components/orders/send-delivery-button.tsx` | Per-order one-click dispatch |
| `app/dashboard/deliveries/page.tsx` (modified) | Auto-mode empty-state copy |
| `app/dashboard/settings/page.tsx` (modified) | Smart Delivery Mode section |
| `app/dashboard/orders/[id]/page.tsx` (modified) | Mounts SendDeliveryButton |
| `lib/help/articles.ts` (modified) | `smart-delivery-mode` help article |
| `lib/i18n/messages/{en,es,fr,pt}.ts` (modified) | New copy for auto-mode + toggle + button |
| `tests/auto-attach-create.test.ts` | 7 tests covering auto-create + bundle + bails |
| `tests/remove-stop-on-cancel.test.ts` | 7 tests covering the cancellation RPC wrapper |
| `tests/smart-delivery-flow.test.ts` | 2 flow tests stitching auto-attach + cancellation cleanup end-to-end |

## Decisions explicitly NOT made in Sprint 1.5

These came up in planning but are intentionally deferred:

- **Single-stop terminology change** ("Delivery for X" vs "Route — 1 stop"): nice polish but a string change in two places; pushed to a small follow-up so the engine + UX surface ships first.
- **Geographic clustering for same-day bundling**: requires a real route optimization API (Google Routes / Mapbox). Belongs with Sprint 5.
- **Per-route auto-assign of driver/vehicle**: the system creates routes with `null` driver/vehicle. Operators still pick those manually. Auto-assignment requires modeling driver capacity / shift schedules, which is a separate domain.
- **Single-stop terminology change inside the kanban card** ("Delivery for X" vs "Route — 1 stop"): nice polish but a string change in two places; pushed to a small follow-up so the engine + UX surface ships first. The deliveries dashboard already shifts narrative in auto mode via the new top panel; the kanban itself still uses the old labels.

### Resolved during the sprint

- **Customer SMS on dispatch**: the new RPC fires the stop into `en_route` directly, which would have skipped the customer "delivery is on the way" SMS that the legacy `updateStopStatus` action sends inline. Resolved by extracting the SMS+tracking-token issuance into `lib/routes/send-en-route-sms.ts` and calling it from both paths. Both the manual and the auto dispatch now produce the same customer-facing notification.
