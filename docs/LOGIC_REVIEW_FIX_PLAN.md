# Logic Review — Fix Plan

Companion to `docs/LOGIC_REVIEW.md`. Each item is a discrete, checkable fix with the file(s) to touch, the acceptance test that proves it's done, and a rough effort estimate (XS=<30min, S=<2h, M=<1d, L=multi-day).

Sequencing tip: do **Wave 1** before anything else — they're either documentation lies (5 min each) or one-line safety nets that close the worst noob traps. Wave 2 is the real engineering work.

---

## Wave 1 — README + cheap safety nets (do first)

### [ ] 1.1 — Remove `pickup_pending` from the documented pipeline (or implement it)
- **Effort:** XS
- **Files:** `README.md:127-132`, `lib/integrations/quickbooks/csv-export.ts` (stray string ref)
- **Decision needed:** add the status to `lib/validation/orders.ts:42-52` + `VALID_TRANSITIONS` in `lib/orders/actions.ts:738`, OR delete it from the README. Recommend delete unless we actually have a use case.
- **Done when:** README pipeline matches the enum; `grep -r pickup_pending` returns only intentional matches.

### [ ] 1.2 — Fix the Copilot "read-only" claim in the README
- **Effort:** XS
- **Files:** `README.md:35`
- **Done when:** README accurately describes that admins/owners can mutate website content via the Copilot action endpoint (`app/api/copilot/action/route.ts:15-125`).

### [ ] 1.3 — Show "you are in: {org.name}" in the dashboard shell
- **Effort:** S
- **Files:** `components/layout/` (DashboardShell), `lib/auth/org-context.ts`
- **Done when:** the active org name is visible on every dashboard page (sidebar header or top bar). Cheap insurance against silent multi-org confusion until a real switcher exists.

### [ ] 1.4 — "Select a date for accurate availability" hint on `/inventory`
- **Effort:** XS
- **Files:** `app/inventory/page.tsx:72-73`, `components/public/CatalogFilterForm.tsx`
- **Done when:** when no date is in the filter, the page renders a visible callout above the grid and either (a) hides "Available" badges or (b) renames them to "Pick a date to check availability".

### [ ] 1.5 — Show outstanding balance on the record-payment form
- **Effort:** S
- **Files:** `components/payments/record-payment-form.tsx`
- **Done when:** the form shows current `balanceCents` (and `depositRequiredCents` if applicable) above the amount input, so operators don't overpay/underpay blind.

### [ ] 1.6 — Confirmation step on crew stop actions
- **Effort:** S
- **Files:** `components/crew/stop-actions.tsx:44-52`, `lib/crew/actions.ts:186-232`
- **Done when:** tapping "Mark En Route" / "Mark Delivered" opens a confirm sheet that mentions any side effects (e.g. "this will text the customer that you're on the way"). Add a quick undo window if cheap.

---

## Wave 2 — Real fixes (correctness)

### [ ] 2.1 — Document `VALID_TRANSITIONS` table
- **Effort:** M
- **Files:** `lib/documents/actions.ts:80-127`, `app/api/portal/sign-document/route.ts:119-136`, `lib/validation/documents.ts`
- **Behavior to encode:**
  - `pending → sent | void`
  - `sent → signed | void`
  - `signed → void` (only via explicit "revoke", with audit trail)
  - `void → ` (terminal; require explicit re-issue = new document row, not status flip)
- **Bonus:** require `document_status === "sent"` before customer portal signature (currently it accepts `pending`).
- **Done when:** any disallowed transition returns an error; a unit test covers `signed → sent → pending → signed` and asserts it's rejected.

### [ ] 2.2 — Block dashboard `confirmed → delivered` skip
- **Effort:** S–M
- **Files:** `lib/orders/actions.ts:738` (keep allowed at the data layer), the dashboard order-detail action UI (the page that exposes the status dropdown)
- **Done when:** from the dashboard, "Mark delivered" on a `confirmed` order is disabled or hidden until it's been `out_for_delivery`. Crew/route writes that legitimately need `confirmed → delivered` still work via the crew/route code paths.

### [ ] 2.3 — Enforce `payment_type` semantics (or make it a label-only)
- **Effort:** M
- **Files:** `lib/payments/actions.ts:169-173`, `lib/payments/compute-financials.ts:56`, `components/payments/record-payment-form.tsx`
- **Pick one:**
  - **Enforce:** "balance" payments require `depositFulfilled === true` and only reduce `balanceCents`; "deposit" payments cannot exceed `depositRequiredCents`.
  - **Honest label:** rename "deposit / balance / partial / refund" to "Payment (deposit) / Payment (balance) — reporting only" and document in a UI tooltip that all non-refund payments just add to `net_paid`.
- **Done when:** behavior matches the label; auto-confirm logic uses whichever rule we picked.

### [ ] 2.4 — Make maintenance actually block bookings
- **Effort:** M
- **Files:** `lib/data/products.ts:47-61`, `lib/data/catalog-availability.ts`, `lib/checkout/actions.ts:301-311`, `lib/maintenance/actions.ts`
- **Behavior:**
  - Catalog should hide (or visibly badge as "Out for service") products whose underlying assets are all under maintenance.
  - Checkout should refuse to reserve an asset whose `operational_status !== 'ready'`.
- **Done when:** an asset toggled to `under_maintenance` disappears from `/inventory` and a direct checkout attempt is rejected with a clear error.

### [ ] 2.5 — Reject orders missing `event_date` (or surface them prominently)
- **Effort:** S
- **Files:** `components/orders/new-order-form.tsx`, `lib/orders/actions.ts` (validation), `app/dashboard/orders/` (list view), `lib/data/unrouted-orders.ts:68`
- **Pick one:**
  - **Hard:** make `event_date` required in the schema and form.
  - **Soft:** allow null, but add a "Missing event date" filter pill on the orders list and a banner on the order detail page.
- **Done when:** an order with no `event_date` either can't be created OR is visibly flagged on the dashboard.

### [ ] 2.6 — Multi-day rentals create stops for every day
- **Effort:** M–L
- **Files:** `lib/routes/auto-attach.ts:99,124`, schema (may need a `stops.kind = 'delivery' | 'pickup' | 'check_in'`), `app/dashboard/deliveries/`
- **Behavior:** an order with `event_date` and `rental_end_date` spanning N days should produce a delivery stop on day 1 and a pickup stop on day N (and optionally daily check-in stops if the rental requires it).
- **Done when:** creating a Mon–Wed rental auto-creates two routed stops (Mon delivery, Wed pickup) on the corresponding routes, and the calendar shows both.

### [ ] 2.7 — Close the catalog check→reserve TOCTOU
- **Effort:** M
- **Files:** `lib/checkout/actions.ts:443-472, 689-713, 808, 820-851`, `lib/availability/blocks.ts:45-54`
- **Behavior:** reserve the availability block **before** the `orders` insert (or in the same transaction). On reserve failure, no `orders` row should exist to clean up. Eliminate the best-effort rollback at `:820-851`.
- **Done when:** simulating two concurrent bookings for the same product+date produces exactly one order (the winner) and zero orphaned rows.

### [ ] 2.8 — Validate `rentalEndDate >= eventDate`
- **Effort:** XS
- **Files:** `lib/checkout/actions.ts:331-342`, `components/checkout/CheckoutForm.tsx`
- **Done when:** a reversed date range is rejected with a clear error rather than silently clamping to 1 day.

### [ ] 2.9 — Fail (or warn) when product `base_price` is null/zero
- **Effort:** S
- **Files:** `lib/checkout/actions.ts:314-315`, `lib/data/catalog-list.ts:111-114`, dashboard product list
- **Behavior:** remove the magic `225` default. Either refuse to render the product on the storefront when price is unset, or refuse checkout. Surface "missing price" as a dashboard warning.
- **Done when:** the `225` literal is gone and customers can't be charged a placeholder amount.

### [ ] 2.10 — Enforce service-area min order regardless of ZIP completeness
- **Effort:** S
- **Files:** `lib/checkout/actions.ts:261-287, 385`
- **Done when:** a delivery checkout with a missing/invalid ZIP is rejected before pricing, not silently allowed past the minimum check.

### [ ] 2.11 — Cancel-then-rebook race + cancel-removes-stops
- **Effort:** M
- **Files:** `lib/orders/actions.ts:792-807`, `lib/availability/actions.ts:200-220`, `lib/crew/actions.ts`, route stop deletion
- **Behavior:** when an order is cancelled, also remove its open route stops in the same transaction as the availability release. Ensure the release+rebook sequence holds a lock per `(product_id, date)`.
- **Done when:** cancelling an order in mid-route makes the stop disappear from the crew app and reopens availability atomically.

### [ ] 2.12 — Refund auto-flip is rounding-robust
- **Effort:** XS
- **Files:** `lib/payments/actions.ts:225-233`
- **Done when:** the auto-flip condition uses an epsilon (or integer cents) so a $99.99 refund on a $100 order behaves like a full refund.

---

## Wave 3 — Onboarding & multi-tenancy

### [ ] 3.1 — Org switcher UI
- **Effort:** M
- **Files:** `components/layout/` (DashboardShell), new `components/auth/OrgSwitcher.tsx`, `lib/auth/org-context.ts:34-40` (accept an `active_org_id` from a cookie or membership.preferred=true)
- **Done when:** users with 2+ memberships can switch orgs from the sidebar and the choice persists.

### [ ] 3.2 — Onboarding resume affordance
- **Effort:** S
- **Files:** `app/onboarding/page.tsx`, `components/onboarding/OnboardingForm.tsx`, `middleware.ts:173-187`
- **Behavior:** persist partial onboarding state (localStorage or a `pending_onboarding` row) and show a "Welcome back — let's finish setting up {orgName}" banner on return.
- **Done when:** closing the tab mid-onboarding and reopening lands on the form pre-filled with what was entered.

### [ ] 3.3 — Accept-invite reconciles with existing org context
- **Effort:** S
- **Files:** `lib/team/accept-invite.ts:44-49,84`, `lib/auth/org-context.ts:34-40`
- **Behavior:** when an invite is accepted, switch the active org to the invited org (or prompt user to choose).
- **Done when:** the success message and the dashboard data agree on which org the user just entered.

### [ ] 3.4 — Resend verification email
- **Effort:** S
- **Files:** `app/login/page.tsx`, `lib/auth/actions.ts:269-322`
- **Done when:** the login page shows a "resend verification email" link when the user is unverified.

### [ ] 3.5 — Demo-mode honesty on onboarding
- **Effort:** XS
- **Files:** `lib/onboarding/actions.ts:47-52`, `app/onboarding/page.tsx` (success state)
- **Done when:** in demo mode, the success page links to a demo dashboard or shows "Demo mode — connect Supabase to persist your org", not the real `/dashboard` route that bounces back.

### [ ] 3.6 — Setup checklist items that auto-complete
- **Effort:** S
- **Files:** `lib/guidance/checklist.ts:19-100`
- **Done when:** `brand-setup` and `pricing-rules` derive `isComplete` from real org data (e.g. branding colors set, at least one product with non-null price) instead of `() => false`.

### [ ] 3.7 — Validate invite role on accept
- **Effort:** XS
- **Files:** `lib/team/accept-invite.ts:84`
- **Done when:** unknown roles are rejected or coerced to a safe default; covered by a unit test.

---

## Wave 4 — Logistics & operator UX polish

### [ ] 4.1 — Calendar shows delivery dates, not just event dates
- **Effort:** S
- **Files:** `lib/data/calendar.ts:56-76`, `components/calendar/`
- **Done when:** the calendar surfaces route_date events distinct from event_date (or a toggle: "Events" vs "Deliveries").

### [ ] 4.2 — Calendar "+N more" is clickable
- **Effort:** XS
- **Files:** `components/calendar/month-grid.tsx:171-226`
- **Done when:** clicking "+N more" opens a day-view modal listing every event.

### [ ] 4.3 — Surface stop scheduled times on the route kanban
- **Effort:** S
- **Files:** `app/dashboard/deliveries/[id]/page.tsx`, `app/dashboard/deliveries/page.tsx`, `components/deliveries/`
- **Done when:** each route card shows the first/last scheduled times without opening the detail page.

### [ ] 4.4 — Disambiguate Orders / Calendar / Deliveries
- **Effort:** S (copywriting + small UI)
- **Files:** `lib/navigation/dashboard-nav.ts:27-31`, the three landing pages
- **Done when:** each landing page has a one-liner subtitle ("All orders by pipeline stage" / "Events by date" / "Routed deliveries by day") and the help center cross-links them.

### [ ] 4.5 — Service-area lookup ambiguity is operator-visible
- **Effort:** S
- **Files:** `lib/service-areas/lookup.ts:73-91`, `app/dashboard/service-areas/`
- **Done when:** the dashboard shows an "overlapping coverage" warning for any city/state with multiple service areas; lookup uses a deterministic tie-breaker (e.g. tightest ZIP match, then most-recently-updated).

### [ ] 4.6 — Hardcoded timezone default
- **Effort:** XS
- **Files:** `components/onboarding/onboarding-form.tsx:208-213`
- **Done when:** default is derived from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with `America/New_York` as fallback only.

### [ ] 4.7 — Auto-reattach order to route on event-date change
- **Effort:** S
- **Files:** `lib/orders/actions.ts:595-645, 1021-1072`
- **Done when:** changing an order's `event_date` after creation moves it off the old route and onto the new date's route.

### [ ] 4.8 — Resize / move the "Remove Stop" button
- **Effort:** XS
- **Files:** `components/deliveries/route-controls.tsx:133-170`
- **Done when:** Remove Stop is visually separated from the action buttons (different row, destructive styling, or behind an overflow menu).

---

## Quick reference — full severity counts

- **Critical fixes** (Waves 1.1–1.4, 2.1–2.6, 2.7, 3.1, 3.3, 4.1 partly): the noob-traps from the report.
- **Moderate fixes**: most of Wave 2 + Wave 3.
- **Minor fixes**: Wave 4 polish.

See `docs/LOGIC_REVIEW.md` for the full finding-by-finding analysis with `file:line` cites.
