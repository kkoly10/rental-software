# Feature Validation Checklist

Run through this manually after each meaningful merge to main, using the [tester account](./TESTING_ACCOUNT.md). The CI suite catches "did the route 500?" — this catches "did the feature actually work?"

Order matters: each section depends on the data created by the previous one. Reset the test org between full runs by signing in as the tester, going to **Settings → Delete Account** (the demo data flow), and signing up fresh.

## Phase 0 — Setup

- [ ] Sign in with `comlan11@gmail.com`
- [ ] Land on `/dashboard`, no errors in the browser console
- [ ] Verify org name shows in the top-left
- [ ] Settings → Smart Delivery Mode shows **Auto-scheduling is on** (default for new orgs)
- [ ] Settings → Integrations shows QuickBooks + Xero cards (Connect buttons visible)
- [ ] Settings → SMS Notifications → WhatsApp section visible (toggle OFF by default)

## Phase 1 — Sprint 1: Pull sheets + QuickBooks CSV

### Pull sheets
- [ ] Create a route with 2 delivery stops (use the Smart Delivery Mode auto-create flow: confirm 2 orders for the same date)
- [ ] Open the route detail page
- [ ] Click **Pull sheet** → HTML page loads with "Load totals" + "Stop-by-stop" sections
- [ ] Click **Download PDF** → file downloads as `pull-sheet-{routename}.pdf`
- [ ] Open the PDF — verify checkboxes appear next to each item
- [ ] Verify the "Load totals" sum matches the items across stops

### QBO CSV export
- [ ] Go to **Payments** page
- [ ] Click **Export for QuickBooks** → CSV downloads as `quickbooks-invoices-{date}.csv`
- [ ] Open in spreadsheet app — verify column headers match Intuit's import template (`InvoiceNo`, `Customer`, `InvoiceDate`, `DueDate`, `Item(Product/Service)`, `ItemQuantity`, `ItemRate`, `ItemAmount`, `Memo`)
- [ ] Verify each order shows one row per line item + a separate "Delivery Fee" row when applicable

## Phase 2 — Sprint 1.5: Smart Delivery Mode

### Auto-create + auto-bundle
- [ ] Create a fresh order for 7 days from today, set status to **Confirmed**
- [ ] Verify `/dashboard/deliveries` shows a **Deliveries for {date}** route auto-created
- [ ] Create a second order for the same date, confirm
- [ ] Verify it lands on the same route (not a new one) as stop #2
- [ ] Verify the stop sequence reflects event-time order (later event_time = later stop)

### Send delivery (one-click dispatch)
- [ ] Open the first order's detail page
- [ ] Click **Send delivery**
- [ ] Verify order status flips to `out_for_delivery`
- [ ] Verify route status on `/dashboard/deliveries` flips to `in_progress`
- [ ] (If SMS env wired) Verify customer received the "delivery is on the way" text

### Cancellation chain
- [ ] Create a route with 2 stops
- [ ] Cancel the first order
- [ ] Verify the route now shows 1 stop (not "0 stops + cancelled" weirdness)
- [ ] Cancel the second order
- [ ] Verify the route is gone from the kanban (planned + 0 stops → auto-delete)

### Manual mode toggle
- [ ] Settings → Smart Delivery Mode → **Switch to manual**
- [ ] Verify `/dashboard/deliveries` now shows the **Create a Route** form prominently
- [ ] Toggle back to auto

## Phase 3 — Sprint 2: QuickBooks Online

Requires `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` / `QBO_REDIRECT_URI` / `QBO_ENVIRONMENT` configured on the deploy. Skip if not wired.

- [ ] Settings → Integrations → **Connect QuickBooks**
- [ ] Authorize a sandbox QBO company
- [ ] Land back on Settings with **QuickBooks connected** banner
- [ ] On any confirmed order, click **Sync to QuickBooks**
- [ ] Open QBO sandbox in another tab → verify the customer + invoice appear
- [ ] Mark the order as `delivered` → verify auto-sync fires (check QBO again within ~30s)
- [ ] Settings → Disconnect → verify the card returns to "Connect" state

## Phase 4 — Sprint 3: Recurring booking series

- [ ] Open a confirmed order
- [ ] Click **Make recurring** → pick **Weekly**, multiplier 1, end date 4 weeks out
- [ ] Click **Create series**
- [ ] Verify message "Generated 3 future bookings" (template = occurrence 1, 3 more = total 4)
- [ ] Open the Calendar page → verify 4 orders appear on the right dates
- [ ] Open one of the child orders → verify the **Series controls** card appears at the bottom
- [ ] Click **Pause series** → verify message "Series paused"
- [ ] Click **Resume series** → message returns "Series resumed"
- [ ] Click **Cancel series** with **Also cancel future bookings** unchecked → past + future stay, series shows cancelled
- [ ] Create another series, this time **with** "Also cancel future" → verify the future children flip to cancelled

## Phase 5 — Sprint 3.5: Xero

Requires `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / `XERO_REDIRECT_URI`. Skip if not wired.

- [ ] Settings → Integrations → **Connect Xero**
- [ ] Authorize a Xero demo organization
- [ ] Land back on Settings with **Xero connected** banner
- [ ] Confirmed order → click **Sync to Xero**
- [ ] Open Xero → verify the contact + invoice (status AUTHORISED) appear
- [ ] Mark order `delivered` → verify auto-sync via the daily reconcile or manual button

## Phase 6 — Sprint 4: WhatsApp Business

Requires Twilio WhatsApp sandbox + at least one approved Meta template + the corresponding `WHATSAPP_TEMPLATE_*` env var. Skip if not wired.

- [ ] Settings → SMS Notifications → WhatsApp section → enable + paste sandbox sender
- [ ] Open a customer detail page → scroll to the **WhatsApp / Notification channel** section
- [ ] Tick **Send notifications over WhatsApp** and save → verify success badge
- [ ] (Optional) Enter a separate WhatsApp number in the override field and save
- [ ] Trigger an order confirmation (confirm a new order)
- [ ] Verify the customer's WhatsApp received the template message (sandbox: opt-in by texting "join {sandbox-code}" to the Twilio number first)
- [ ] Open the customer's comm log → verify the entry shows **WhatsApp** channel badge
- [ ] Disable the channel → re-confirm an order → verify it now sends via SMS

## Phase 7 — Sprint 5: Route auto-optimization

Requires `MAPBOX_ACCESS_TOKEN`. Skip if not wired.

- [ ] Create a route with 4+ stops, each tied to an order with a geocoded delivery address
- [ ] Open the route detail page
- [ ] Click **Optimize route**
- [ ] Verify the success message shows distance + time (e.g., "Optimized — 47 mi, 1h 38m")
- [ ] Refresh the page → verify stops are now in the optimized order (sequence numbers updated)
- [ ] Try optimizing a route in `in_progress` status → verify the button is hidden
- [ ] Add a stop with a non-geocoded address → re-optimize → verify it lands at the tail with the "N stops without coordinates" suffix

## Phase 8 — Smart cancellation regressions (cross-sprint)

- [ ] Create an order, confirm, dispatch (Sprint 1.5 happy path)
- [ ] Cancel the order
- [ ] Verify route stop auto-removed (Sprint 1.5 cancellation chain)
- [ ] Verify route status updates if it was the last stop (Sprint 1.5 zombie cleanup)
- [ ] If a recurring series was canceled, verify the child orders show up as `cancelled` (Sprint 3 cancel-future)

## Phase 9 — Documentation surfaces

- [ ] Open the in-app Help Center (`/dashboard/help`)
- [ ] Verify these articles are listed:
  - Setting up a recurring booking (Sprint 3)
  - How auto-scheduling (Smart Delivery Mode) works (Sprint 1.5)
  - Printing a pull sheet for a route (Sprint 1)
  - Connecting QuickBooks Online (Sprint 2)
  - Connecting Xero (Sprint 3.5)
  - Setting up WhatsApp notifications (Sprint 4)
  - Optimizing your delivery route (Sprint 5)
- [ ] Click into each one — body renders, no broken markdown

## Bug log

Record anything failing in a tracked location:
- One row per bug: feature, severity (blocker / major / minor / cosmetic), reproduction steps, expected vs actual
- Tag against the responsible sprint
- Move to GitHub issues for the must-fix items before any beta launch

## Cadence

- After every merge to `main` that touches a feature here, the responsible engineer runs the relevant phase
- Full top-to-bottom run before the founder demos to any customer or investor
- Quarterly full run as a regression check
