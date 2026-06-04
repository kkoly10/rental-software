# Korent — Logic Review

A noob-focused audit of areas where the app's logic doesn't match what the README, the UI, or a reasonable operator would expect. Produced by the `logic-review` skill (four parallel `Explore` agents across the transactional core, identity/onboarding, customer-facing flow, and logistics/operator workspace).

Findings are cited with `file:line` so they can be verified or fixed directly. Severity uses the rubric in `.claude/skills/logic-review/SKILL.md`.

---

## Top 5 noob traps

If a new operator gives up on Korent in their first week, it will probably be because of one of these:

1. **Multi-org silently picks the oldest org with no switcher.** A user who ends up in two orgs (accidental double-onboarding, accepted invite) silently sees the wrong tenant's data and has no UI to switch. `lib/auth/org-context.ts:34-40`.
2. **"Mark delivered" from the dashboard skips dispatch.** An order in `confirmed` can jump straight to `delivered` without `out_for_delivery`. Inventory looks freed, the customer-facing status implies delivery happened, but the truck never left. `lib/orders/actions.ts:738`.
3. **No-date catalog shows "Available" for everything.** With no date filter, `enrichCatalogAvailability` returns the static fallback badge; customers (and operators previewing the storefront) see "Available" on products that are booked solid. `lib/data/catalog-availability.ts:50-51`, `app/inventory/page.tsx:72-73`.
4. **Maintenance is purely informational.** Logging maintenance on an asset never blocks bookings — `lib/data/products.ts:47-61` filters only on `deleted_at`/`is_active`. Operators reasonably assume "in maintenance" means "off the storefront." It doesn't. `lib/maintenance/actions.ts:10-125`.
5. **Documents have no state machine.** Status can move from `signed → void → sent → pending → signed` again. The PDF embeds the first signature date but the record can be re-signed later. Compliance footgun. `lib/documents/actions.ts:80-127`, `app/api/portal/sign-document/route.ts:136`.

---

## 1. Transactional core — orders, payments, documents

### Critical

- **`pickup_pending` is documented in the README but does not exist in the enum.** The status pipeline in `README.md:127-132` ends with `delivered → pickup_pending → completed`, but `lib/validation/orders.ts:42-52` only accepts `inquiry, quote_sent, awaiting_deposit, confirmed, scheduled, out_for_delivery, delivered, completed, cancelled, refunded`. Operators following the README will look for a state that cannot be set. A stray `"pickup_pending"` string in `lib/integrations/quickbooks/csv-export.ts` confirms this is half-implemented.
- **Document status has no `VALID_TRANSITIONS`.** Orders enforce transitions; documents do not. `lib/documents/actions.ts:80-127` (`updateDocumentStatus`) accepts any status. An operator can move a document `pending → sent → signed → void → sent → pending` and the customer portal at `app/api/portal/sign-document/route.ts:136` will let it be re-signed because it only checks `document_status === "pending"`.
- **Documents can be signed before they're ever "sent".** `app/api/portal/sign-document/route.ts:119-136` verifies the doc exists and is `pending`; it does not require `sent`. Operators who think "mark sent" is a prerequisite are wrong — customers can sign anything in `pending`.
- **Order can be marked `delivered` directly from `confirmed`, bypassing dispatch.** `lib/orders/actions.ts:738` includes `delivered` in the allowed transitions out of `confirmed`. The comment at lines 723-726 says this is to support the crew/route apps, but the dashboard exposes the same transition to operators with no warning. Inventory appears freed; the customer status page implies delivery; the equipment never moved.

### Moderate

- **`payment_type` is decorative.** `components/payments/record-payment-form.tsx` offers `deposit | balance | partial | refund`, but `lib/payments/actions.ts:169-173` and `compute-financials.ts:56` only sum `net_paid` and compare to `depositRequiredCents`. Two $50 payments tagged as `balance` will auto-confirm a $200 order whose `depositRequired=$100`. Operators expecting "balance" to be applied only after deposit is fulfilled are wrong.
- **Record-payment form doesn't show current balance.** `components/payments/record-payment-form.tsx` accepts an amount without surfacing what's outstanding, making accidental overpayment likely. The RPC will reject overpayments (`supabase/migrations/20260515_030000_atomic_payment_recording.sql:58-66`), but only after submit.
- **Cancel-then-rebook has a race window.** `lib/orders/actions.ts:792-807` releases availability on cancel; `lib/orders/actions.ts:530-551` reserves availability *after* the order row exists. Two concurrent flows can both pass the JS-level availability check and only one will get the RPC-level reservation — the loser's order is already in the DB by then.

### Minor

- **Refund auto-flip is brittle near $0.** `lib/payments/actions.ts:225-233` flips to `refunded` when `netPaid <= 0`. A $99.99 refund on a $100 order leaves it in its prior status with no operator hint.
- **Auto-attach to route fires on create and on first-confirm but never re-attaches.** `lib/orders/actions.ts:595-645` and `:1021-1072`. Operators who change the event date later won't see the order migrate to the new date's route.

---

## 2. Identity & onboarding — auth, multi-tenancy, setup

### Critical

- **Abandoned onboarding has no resume affordance.** `middleware.ts:173-187` redirects email-confirmed users with no membership to `/onboarding`, but the form has no client-side persistence. Close the tab mid-flow and the next visit is a blank form with no "you were in the middle of setup" hint.
- **`getOrgContext` silently picks the oldest org.** `lib/auth/org-context.ts:34-40` returns the first membership by `created_at ASC`. There is no org-switcher UI anywhere in the app. A user who somehow ends up in two orgs (accept-invite while already onboarded, race-condition on double-submit, dev seeding) is stuck in the wrong tenant with no visible breadcrumb of which one it is.
- **Accept-invite doesn't reconcile with the existing org context.** `lib/team/accept-invite.ts:44-49` creates a new membership and tells the user "Welcome to ${org.name}!" — but their dashboard still resolves to their *older* org via `getOrgContext`. The success message and the actual dashboard data disagree.

### Moderate

- **Demo mode "completes" onboarding without creating anything.** `lib/onboarding/actions.ts:47-52` returns `{ ok: true }` when `!hasSupabaseEnv()`. The success page links to `/dashboard`, where middleware finds no membership and bounces back to `/onboarding`. Devs running without env vars hit a loop with no error.
- **Setup checklist contains items that can never auto-complete.** `lib/guidance/checklist.ts` hardcodes `isComplete: () => false` on `brand-setup` and `pricing-rules`. Operators see them as outstanding forever even after completing the underlying actions.
- **No "resend verification email" affordance.** `lib/auth/actions.ts:269-322` issues a verification email; if the user misses it, the login page (`app/login/`) blocks them with no self-serve resend. They have to create a new account.
- **Welcome/tour state persists in DB per user, not per device.** `lib/guidance/actions.ts:66-74`. On a shared kiosk, a second operator never sees the welcome modal. A user who dismisses the tour mid-step resumes mid-step on next login even if they've since learned the product.

### Minor

- **Onboarding timezone defaults to `America/New_York`.** `components/onboarding/onboarding-form.tsx:208-213`. Hardcoded, no geo guess.
- **Invite roles aren't re-validated on accept.** `lib/team/accept-invite.ts:84` writes the stored role straight into the membership. A corrupted invite row with an unrecognized role becomes a membership with an unrecognized role.
- **Rate-limit is per-email, allowing typo accounts.** `lib/auth/actions.ts:237-250`. By design, but it lets a single human spawn several unverified accounts.

---

## 3. Customer-facing flow — catalog, checkout, availability, pricing

### Critical

- **No date selected = fake availability badges.** `lib/data/catalog-availability.ts:50-51` and `app/inventory/page.tsx:72-73`. Without a date, every product gets its static fallback badge. Customers happily click "Book" on products that are 100% booked for their target date.
- **Check → reserve TOCTOU on simultaneous bookings.** `lib/checkout/actions.ts:443-472` runs a JS-level `checkProductAvailability` and then an RPC `reserveProductAvailabilityBlock`. The RPC is atomic, but the JS check is not — so two checkouts can both pass the JS check, one succeeds at the RPC, and the loser's `orders` row is already inserted before the rollback at `:820-851`. Cleanup is best-effort; orphaned orders are possible.
- **Deleted products produce ghost orders that reserve no inventory.** `lib/checkout/actions.ts:301-311` only does the product visibility check when `productSlug` is provided. With an empty/missing slug, the order is created with `productId=null` (`:289-291, :368`), the availability reservation at `:808` is skipped (`if (productId && eventDate)`), and the operator sees a booking on the dashboard with no product attached and no calendar/availability impact.
- **Minimum order isn't checked when there's no service area.** `lib/checkout/actions.ts:261-287` only looks up the service area when `fulfillmentType="delivery"`; the minimum check at `:385` relies on a populated `serviceArea`. A delivery order with a missing/invalid ZIP slips past the minimum.

### Moderate

- **Null/zero base price silently defaults to $225.** `lib/checkout/actions.ts:314-315`. Operators who forget to set pricing still take real money at a magic-number default. The catalog UI separately renders `$0/day` (`lib/data/catalog-list.ts:111-114`) — so customers see $0 on the catalog and a $225 line item at checkout.
- **Deposit minimum is clamped to total with only a log line.** `lib/checkout/actions.ts:643-656`. The customer sees the clamped deposit; the operator gets a `deposit_minimum_clamped` log entry they will probably never read. The intent of the minimum is silently overridden on small orders.
- **Multi-day pricing accepts a reversed range and silently bills 1 day.** `lib/checkout/actions.ts:331-342` does `Math.max(1, dayDiff + 1)` with no validation that `rentalEndDate >= eventDate`. A customer entering dates backwards is undercharged with no error.
- **Catalog filter form is cosmetic until the customer interacts.** `components/public/catalog-filter-form.tsx:15-60`. Landing on `/inventory` shows "Available" badges that mean nothing; nothing on the page tells the user "pick a date first."
- **Service-area lookup with multiple matches returns an arbitrary one.** `lib/service-areas/lookup.ts:73-91`. A city that overlaps two zones gets the first match, possibly with the wrong delivery fee. There's a log line but no UI flag.

### Minor

- **Availability is computed per-day, not per-hour.** `lib/availability/window.ts:45-75` supports time windows, but the storefront filter only collects a date. Two 3-hour rentals on the same day appear mutually exclusive even when they could co-exist.
- **Checkout summary doesn't refresh on ZIP change.** `app/checkout/page.tsx:117-122` renders pricing before the customer enters a ZIP; a later ZIP that's out of service area returns an error after the summary already showed a total.

---

## 4. Logistics & operator workspace — routes, crew, maintenance, nav, copilot

### Critical

- **Copilot **does** modify data; README says it doesn't.** `app/api/copilot/action/route.ts:15-25` defines action types (`update_hero`, `update_faq`, `update_about`, ...) and `:124` calls `mergeOrgSettings`. Owner/admin gated (`:72-73`), but the README claim at line 35 ("read-only — never modifies data") is false.
- **Orders without an `event_date` are invisible to routing.** `lib/routes/auto-attach.ts:99` returns `{ attached: false, reason: "no_event_date" }`; `lib/data/unrouted-orders.ts:68` filters `.eq("event_date", routeDate)`. The order form doesn't visibly mark `event_date` as required, so orphan orders sit unrouted with no banner on the Orders list.
- **Multi-day rentals only get routed for day 1.** `lib/routes/auto-attach.ts:124` keys routes by a single `route_date == eventDate`. A Mon–Wed rental gets a Monday delivery stop; Tue and Wed have no automatic pickup/check-in stops. No operator-facing warning.
- **Maintenance doesn't block bookings.** `lib/maintenance/actions.ts:10-125` writes `maintenance_records` and may set an asset `operational_status`, but `lib/data/products.ts:47-61` and the checkout path never read it. An asset marked under maintenance is still on the storefront and still bookable.

### Moderate

- **Order cancellation doesn't clean up route stops.** Crew → order coupling at `lib/crew/actions.ts:101-112` is one-way (stop completion flips order to `delivered`). No reverse hook removes stops from routes when an order is cancelled.
- **Three views of the same data with no separation guidance.** `lib/navigation/dashboard-nav.ts:27-31` exposes Orders, Calendar, and Deliveries — each filters the order set differently (full pipeline / events by `event_date` / routed orders only). Noobs can't tell which view is authoritative for "what's coming up."
- **Crew stop actions have no confirmation and no undo.** `components/crew/stop-actions.tsx:44-52` is a single click. `lib/crew/actions.ts:186-232` fires customer SMS on the "en route" transition. A mis-tap on a phone in a truck sends a real text to the customer with no preview.
- **Calendar shows `event_date`, not `route_date`.** `lib/data/calendar.ts:56-76`. Operators planning deliveries by the calendar will be off-by-one whenever delivery is the day before the event.

### Minor

- **Remove-stop button is small and inline next to action buttons.** `components/deliveries/route-controls.tsx:133-170`. `window.confirm` is a guard, but the layout invites a mis-tap on mobile.
- **Stop scheduled times aren't surfaced on the kanban.** `lib/routes/auto-attach.ts:199` resequences by `scheduled_window_start`, but the route board (`app/dashboard/deliveries/[id]/page.tsx`) doesn't show those times — operators have to open each route to see ordering.
- **Calendar "+N more" is not clickable.** `components/calendar/month-grid.tsx:171-226` truncates at three events with a non-interactive "+N more" pill.
- **Auto-created asset tag derives from `product.slug` or slugified name.** `lib/maintenance/actions.ts:71-102`. Org-scoped so collisions are bounded, but the visible tag will collide for two same-named products in one org.

---

## Recommended quick wins

Ordered by impact-per-effort, not by severity:

1. **Add a `VALID_TRANSITIONS` table for `documents`** mirroring the orders one. Closes the re-sign / sign-before-sent loophole.
2. **Block the `confirmed → delivered` transition from the dashboard UI** (keep it allowed at the data layer for crew/route writes, but require explicit confirmation in the dispatcher view).
3. **Fix the README:** delete `pickup_pending` from the documented pipeline (or implement it), and rewrite the Copilot description from "read-only" to "read by default; can modify website content for admins."
4. **Show "select a date for accurate availability" on `/inventory`** when no date is in the filter. Cheapest possible fix for the biggest customer-facing footgun.
5. **Read `operational_status` in `lib/data/products.ts`** and hide/disable maintenance-flagged assets at the catalog and checkout layers.
6. **Surface "you are in: {org.name}" somewhere on the dashboard shell**, even as a static label. Cheapest possible insurance against silent multi-org confusion.
7. **Add a "Save & continue later" intermediate on onboarding** plus a "resume your setup" banner on next login if onboarding is incomplete.
