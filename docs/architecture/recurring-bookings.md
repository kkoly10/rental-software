# Recurring Booking Series (Sprint 3)

## Why this exists

Booqable's documented weakness: it can't auto-generate monthly bookings for long-running rentals (tents, generators, equipment). Goodshuffle Pro doesn't ship recurring at all. Sprint 3 closes both gaps — operators can mark an order recurring, and Korent auto-creates the future bookings on the chosen cadence.

Two use cases the same model serves:
- **Repeat-event rental** (party rental): "this customer rents the bouncy castle every Saturday for 8 weeks"
- **Long-running monthly rental** (Booqable wedge): "this customer rents the storage tent month-to-month until they tell us to stop"

The design choice: each cycle produces a **new child order** with its own `event_date`, not a single long-running order with monthly billing periods. Keeps the data model consistent with the existing per-event order shape and lets each cycle's delivery, pickup, and payment be tracked independently.

## Data model

Two-table shape:

```
order_series                     orders
─────────────                    ──────
id                               id
organization_id                  ...
customer_id                      order_series_id           ◄─── nullable FK
template_order_id     ─────────► event_date
frequency                        series_occurrence_number  ◄─── 1-indexed
interval_count
start_date
end_date              (optional)
max_occurrences       (optional)
status                (active | paused | cancelled | completed)
last_generated_through
created_at
created_by_profile_id
cancelled_at
cancelled_by_profile_id
deleted_at
```

The `last_generated_through` column is the cron's bookmark — it's the most recent event_date we've already emitted a child order for. The expansion routine starts walking from there.

## Cadence algebra

`lib/orders/series-cadence.ts` is a pure module — no Supabase, no clock dependency beyond what's passed in. Two key functions:

### `nextOccurrenceDate(anchor, cadence)`

Given a date and a cadence, returns the next occurrence's date. Handles:
- **Daily / weekly / biweekly**: simple day arithmetic, UTC-anchored to avoid DST drift.
- **Monthly**: preserves day-of-month when possible; clamps to the last day of the target month when the source day doesn't exist (Jan 31 + 1 month → Feb 28 or Feb 29). This matches what Google Calendar, iCal, and Outlook do for recurring events.
- **Quarterly**: monthly with a 3× multiplier.

### `enumerateOccurrences({ ... })`

Walks the cadence to emit every date within a window, honoring all three termination conditions (`end_date`, `max_occurrences`, soft horizon `through`). Returns `reachedTerminus: true` only when the series has hit a hard stop (`end_date` or `max_occurrences`) — the soft horizon doesn't count, because the cron will keep extending it.

Numbering: `occurrenceNumber` is **1-indexed against the series**, not the batch. So if 3 children already exist (`alreadyGeneratedThrough = "2026-06-15"`), the next emission starts at `occurrenceNumber: 4`. The operator-facing "occurrence 5 of 12" label stays consistent.

### Month-end "drift" caveat

For a monthly series starting Jan 31:
- Occurrence 1: Jan 31
- Occurrence 2: Feb 29 (clamped — Feb has no 31)
- Occurrence 3: Mar 29 (shifted from Feb 29, not from Jan 31)
- Occurrence 4: Apr 29
- ...

Each occurrence shifts from the **previous occurrence**, not from the start date. This is the standard semantics across calendar apps; the alternative (always shift from start) would produce inconsistent results for some months and confuse operators who expect "monthly" to mean "1 month after last time."

Tested by `tests/series-cadence.test.ts` — 17 unit tests covering month-end, year boundaries, leap years, soft/hard termination, batch cap, misconfigured ranges.

## Expansion lifecycle

1. **Operator creates a series.** `createSeriesFromOrder` runs:
   - Insert the `order_series` row.
   - Back-point the template order at the series (`order_series_id`, `series_occurrence_number = 1`).
   - Eagerly expand up to the 2-year horizon, capped at 104 emissions per batch.

2. **Each expansion call** (`expandSeriesInternal`):
   - Loads the series, the template order's items + financials.
   - Walks `enumerateOccurrences` from `last_generated_through`.
   - For each occurrence: insert a new child order copying customer, address, items, financials, status='confirmed'.
   - Bumps `last_generated_through`.
   - If the series hit its hard terminus AND we emitted all the occurrences, mark `status='completed'`.

3. **Daily cron** (`/api/cron/expand-recurring-series` at 03:00 UTC):
   - Pulls every `status='active'` series.
   - Re-runs `expandSeriesInternal` on each.
   - Idempotent: series with nothing new to emit cost ~1 query each.

4. **Cancellation** (`cancelSeries`):
   - Marks the series cancelled.
   - **Optional** also-cancel-future-bookings checkbox cancels children whose `event_date >= today` and whose status is still cancellable (inquiry / quote_sent / awaiting_deposit / confirmed).
   - Past child orders are always left alone — they happened, and bookkeeping shouldn't change retroactively.

5. **Pause / resume** (`setSeriesStatus`):
   - Pause: status='paused', no new children get generated. Existing children stay intact.
   - Resume: status='active', immediately re-expand to catch up missed cycles.

## Safety caps

- `interval_count` constrained to 1-52 at the schema level (check constraint).
- `max_occurrences` constrained to 2-1000 by the validator (rejecting 1 would block intentional one-off series; rejecting 1000+ blocks accidental "every day forever").
- Single expansion call capped at 104 emissions (~2 years of weekly) to keep within Vercel's 60s function envelope.
- 2-year horizon (`MAX_EXPANSION_HORIZON_DAYS = 730`) bounds storage for indefinite series.
- Loop guard at 100,000 iterations in `enumerateOccurrences` as defense-in-depth against degenerate cadence inputs.

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_050000_recurring_order_series.sql` | Schema: `order_series` table + `orders.order_series_id` + `series_occurrence_number` + RLS |
| `lib/orders/series-cadence.ts` | Pure cadence math (next date + enumerate occurrences) |
| `lib/orders/series.ts` | Server actions: createSeriesFromOrder, expandSeriesInternal, cancelSeries, setSeriesStatus |
| `lib/data/order-series.ts` | Fetcher for the SeriesInfoCard |
| `app/api/cron/expand-recurring-series/route.ts` | Daily expansion cron |
| `components/orders/make-recurring-form.tsx` | Inline "Make recurring" form on the order page |
| `components/orders/series-info-card.tsx` | Series status + pause/cancel controls on child orders |
| `app/dashboard/orders/[id]/page.tsx` (modified) | Mounts MakeRecurringForm + SeriesInfoCard |
| `vercel.json` (modified) | Adds the daily cron entry |
| `tests/series-cadence.test.ts` | 17 unit tests for the cadence math |

## Test coverage

| Layer | Coverage | File |
|---|---|---|
| Cadence math | ✅ 17 tests | `tests/series-cadence.test.ts` |
| Series CRUD + expansion (with fake Supabase) | ⏳ Deferred to Sprint 3.5 | (would need a fuller fake DB to model series + orders + items relationships) |
| Cron auth gating | ✅ existing pattern | (same `verifyCronSecret` envelope as other crons) |
| Playwright end-to-end (signup → make recurring → verify N children) | ⏳ Deferred — requires authed Supabase |

## Deferred to Sprint 3.5

- **Calendar view shows series instances with link to parent**: the calendar already renders child orders by event_date, but doesn't yet badge them as "part of series." Add a small badge + "View series" link.
- **Email / SMS template adjustments**: deposit reminders for child orders currently say "Order #1234"; they should also reference "occurrence 3 of 12" so customers don't think it's a duplicate.
- **Edit series cadence after creation**: today the cadence is immutable. If the operator picks "weekly" then realizes it should be "monthly", they have to cancel and re-create.
- **Edit template items after creation**: items copied at create time are frozen. A future enhancement: a "regenerate future occurrences" button that pulls fresh items from the (now-updated) template.
- **Variable pricing per occurrence**: each child currently inherits the template's totals. Some customers (long-running tent rental with annual price escalator) want different totals over time. Phase 2.
