# QuickBooks CSV Export

## What this is

A Sprint 1 quick-win that lets operators export paid invoices in a format QuickBooks Online accepts via its built-in import wizard. Removes the immediate "do you sync with QuickBooks?" sales objection before the full Intuit-certified two-way sync ships in Sprint 2.

## What it does NOT do

- Does NOT automatically sync data to QuickBooks
- Does NOT push payments, customers, or products live
- Does NOT handle refunds, voids, or credit notes
- Does NOT support QuickBooks Desktop (only Online)

For full automated sync, wait for Sprint 2 (target: weeks 3-4 of the Phase 1 timeline).

## How to use it (operator-facing)

1. In the dashboard, go to **Payments**
2. Click **Export for QuickBooks** (next to the regular CSV export button)
3. Open the downloaded `quickbooks-invoices-YYYY-MM-DD.csv` file
4. In QuickBooks Online, go to **Settings → Import data → Invoices**
5. Upload the CSV; QBO will walk through field mapping
6. Map any new customers or items when prompted
7. Confirm the import

## CSV column reference

| Column | Source | Notes |
|---|---|---|
| InvoiceNo | `orders.order_number` | Unique per organization |
| Customer | `customers.first_name + last_name` | |
| CustomerEmail | `customers.email` | QBO matches by email if customer exists |
| InvoiceDate | `orders.created_at` (date only) | When the order was placed |
| DueDate | `orders.event_date` | Defaults to event date for rentals |
| Item(Product/Service) | `order_items.item_name_snapshot` | Map to a QBO Service item on first import |
| ItemDescription | Same as Item | |
| ItemQuantity | `order_items.quantity` | |
| ItemRate | `order_items.unit_price` | Per-unit price |
| ItemAmount | `order_items.line_total` | `unit_price × quantity` |
| Memo | `"Event: " + event_date` | Helps the accountant tie the line back to a rental day |

Each order line becomes one CSV row. Delivery fees are emitted as their own row with `Item = "Delivery Fee"` so the bookkeeper can map them to a dedicated service code.

## What's included in the export

The export filters to orders in these statuses (i.e., real bookings, not abandoned quotes):

- `confirmed`
- `scheduled`
- `out_for_delivery`
- `delivered`
- `pickup_pending`
- `completed`

Cancelled, refunded, and draft/inquiry orders are excluded.

Capped at the most recent 2,000 orders to prevent runaway exports. If an operator has more than that, run the export with date-range filters (planned for Sprint 1.5).

## Plan gating

Available on **Pro** and **Growth** tiers. This is intentional — the Pro tier's positioning is "includes the QuickBooks sync that Goodshuffle charges $39/mo extra for." See [`COMPETITIVE_POSITIONING_MASTER_PLAN.md`](../../COMPETITIVE_POSITIONING_MASTER_PLAN.md).

The generic CSV export (orders, customers, payments) stays gated to Growth so we don't cannibalize the Growth upsell for bulk data dumps.

## Implementation

- Server action: `lib/integrations/quickbooks/csv-export.ts` → `exportQuickBooksInvoicesCsv()`
- UI button: `app/dashboard/payments/page.tsx` — uses the existing `ExportCsvButton` component
- Gate: `lib/stripe/gate.ts` → `quickbooks_export` feature flag (`["pro", "growth"]`)

CSV-injection protection (formula-trigger prefix) mirrors `lib/export/csv.ts`. Any contributor adding new columns should preserve `escapeCsvField` semantics.
