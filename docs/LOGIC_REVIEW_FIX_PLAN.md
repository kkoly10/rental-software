# Logic Review — Fix Plan (v2)

Companion to `docs/LOGIC_REVIEW.md`. Each item is a discrete, checkable fix.

## Legend

- **Effort:** XS = <30 min · S = <2 h · M = <1 day · L = multi-day · XL = multi-week
- **Tags:**
  - `[decision]` — product decision needed before code can start.
  - `[migration]` — touches existing data; needs a data-audit step before the switch flips.
  - `[breaking-ux]` — changes operator-visible behavior; consider a feature flag or release note.
  - `[blocks-on N.N]` — depends on another item landing first (usually because they touch the same code path).

## How to work an item

1. **Verify** the cited `file:line` still matches `main` — the report is a snapshot and lines drift.
2. If tagged `[decision]`, get a sign-off comment on the PR before coding.
3. If tagged `[migration]`, run the data audit first and paste counts into the PR description.
4. Code the fix on its own branch with the acceptance test from the **Done when** line.
5. Check `[ ]` → `[x]` and add the merging PR # next to the item.

## Sequencing principle

Do **Wave 1** before anything else — they're either documentation lies or one-line UX nudges that close the worst noob traps. Inside Wave 2, respect the `[blocks-on]` tags — multiple items touch the auto-confirm path.

---

## Wave 1 — README + cheap safety nets (do first)

### [ ] 1.1 — Remove `pickup_pending` from the README (or implement it) — `[decision]`
- **Effort:** XS (delete) · M (implement)
- **Files:** `README.md:127-132`, `lib/integrations/quickbooks/csv-export.ts` (stray string ref)
- **Decision:** add the status to `lib/validation/orders.ts:42-52` + `VALID_TRANSITIONS` in `lib/orders/actions.ts:738`, OR delete from the README. Default to delete unless there's a real "waiting for customer pickup" use case.
- **Done when:** README pipeline matches the enum; `grep -r pickup_pending` returns only intentional matches.

### [ ] 1.2 — Fix the Copilot "read-only" claim
- **Effort:** XS
- **Files:** `README.md:35`
- **Done when:** README accurately states admins/owners can mutate website content via `app/api/copilot/action/route.ts:15-125`.

### [ ] 1.3 — Show "you are in: {org.name}" in the dashboard shell
- **Effort:** S
- **Files:** `components/layout/` (DashboardShell), `lib/auth/org-context.ts`
- **Done when:** active org name visible on every dashboard page. Cheap insurance against silent multi-org confusion until 3.1 lands.

### [ ] 1.4 — "Pick a date for accurate availability" hint on `/inventory`
- **Effort:** XS
- **Files:** `app/inventory/page.tsx:72-73`, `components/public/CatalogFilterForm.tsx`
- **Done when:** when no date is in the filter, the page either (a) hides "Available" badges or (b) renames them to "Pick a date to check availability", plus shows a banner above the grid.

### [ ] 1.5 — Show outstanding balance on the record-payment form
- **Effort:** S
- **Files:** `components/payments/record-payment-form.tsx`
- **Done when:** form shows current `balanceCents` and `depositRequiredCents` above the amount input.

### [ ] 1.6 — Confirmation step + side-effect preview on crew stop actions
- **Effort:** S
- **Files:** `components/crew/stop-actions.tsx:44-52`, `lib/crew/actions.ts:186-232`
- **Done when:** "Mark En Route" / "Mark Delivered" open a confirm sheet that names side effects ("this will text the customer that you're on the way"). Cheap undo (5-minute window) if it doesn't bloat the PR.

### [ ] 1.7 — Setup checklist auto-completes `brand-setup` and `pricing-rules`
- **Effort:** XS (was misfiled in Wave 3 v1)
- **Files:** `lib/guidance/checklist.ts:83-100`
- **Done when:** `brand-setup` derives from `org.settings.branding` presence; `pricing-rules` derives from "at least one product has non-null price". `() => false` is gone.

### [ ] 1.8 — Sign-before-sent blocked at the portal
- **Effort:** XS (separated out of v1's 2.1 bonus)
- **Files:** `app/api/portal/sign-document/route.ts:119-136`
- **Done when:** signature is rejected unless `document_status === "sent"`. Returns a 409 with clear copy.

---

## Wave 2 — Real correctness (`[blocks-on]` chains matter here)

### [ ] 2.1 — Document `VALID_TRANSITIONS` table
- **Effort:** M
- **Files:** `lib/documents/actions.ts:80-127`, `lib/validation/documents.ts`
- **Test:** unit test rejecting `signed → sent → pending → signed`.
- **Behavior:**
  - `pending → sent | void`
  - `sent → signed | void`
  - `signed → void` (only via explicit "revoke", with audit trail)
  - `void → ` is terminal (re-issue = new row, not status flip)
- **Done when:** disallowed transitions return an error; test green.

### [ ] 2.2 — Block dashboard `confirmed → delivered` skip — `[breaking-ux]`
- **Effort:** S
- **Files:** `lib/orders/actions.ts:738` (data layer stays permissive for crew/route writes), the dashboard order-detail status dropdown
- **Test:** dashboard E2E — "Mark delivered" is disabled on a `confirmed` order; an order moved to `out_for_delivery` via the truck dispatch UI can then be marked `delivered`.
- **Done when:** dashboard rejects the skip but crew/route code paths still work.

### [ ] 2.3 — Decide and enforce `payment_type` semantics — `[decision]` `[blocks-on 2.2]`
- **Effort:** M
- **Files:** `lib/payments/actions.ts:169-173`, `lib/payments/compute-financials.ts:56`, `components/payments/record-payment-form.tsx`
- **Decision:** pick one.
  - **A (Enforce):** "balance" payments require `depositFulfilled === true` and only reduce `balanceCents`; "deposit" cannot exceed `depositRequiredCents`.
  - **B (Honest label):** rename to "Payment (deposit) / Payment (balance) — reporting only" with a tooltip saying all non-refund payments increment `net_paid`. Don't change behavior.
- **Test:** unit tests for the chosen rule against the auto-confirm path.
- **Done when:** behavior matches the label; auto-confirm uses the chosen rule.

### [ ] 2.4 — Make maintenance block bookings — `[migration]` `[breaking-ux]`
- **Effort:** M
- **Files:** `lib/data/products.ts:47-61`, `lib/data/catalog-availability.ts`, `lib/checkout/actions.ts:301-311`, `lib/maintenance/actions.ts`
- **Data audit:** count current assets with `operational_status != 'ready'`. Notify owners of any product about to disappear from their storefront.
- **Test:** asset toggled to `under_maintenance` disappears from `/inventory`; direct checkout attempt is rejected with a clear error.
- **Done when:** above tests pass and the audit count is in the PR description.

### [ ] 2.5 — `event_date` required (or visibly flagged) — `[decision]`
- **Effort:** S
- **Files:** `components/orders/new-order-form.tsx`, `lib/orders/actions.ts`, `app/dashboard/orders/`, `lib/data/unrouted-orders.ts:68`
- **Decision:** hard-require, or allow-null-with-banner.
- **Done when:** an order with no `event_date` either can't be created OR is flagged on the dashboard order list and detail.

### [ ] 2.6 — Multi-day rentals: per-day stops — `[decision]` `[breaking-ux]`
- **Effort:** XL (was misjudged as M-L in v1)
- **Files:** `lib/routes/auto-attach.ts:99,124`, schema (add `stops.kind = 'delivery' | 'pickup' | 'check_in'`), `app/dashboard/deliveries/`, calendar
- **Decision:** scope. Just delivery+pickup, or also daily check-ins? Per-product config or org-wide?
- **Test:** Mon–Wed rental auto-creates a Mon delivery and a Wed pickup, both on the correct route_dates; calendar shows both.
- **Done when:** above, plus a migration that backfills pickups for existing in-flight multi-day rentals (or punts on backfill with a documented exception).

### [ ] 2.7 — Close the catalog check→reserve TOCTOU
- **Effort:** L (was M in v1 — order create has customer/address writes today)
- **Files:** `lib/checkout/actions.ts:443-472, 689-713, 808, 820-851`, `lib/availability/blocks.ts:45-54`
- **Test:** concurrent-booking test (two parallel checkouts for same product+date) produces exactly one order and zero orphans.
- **Done when:** reserve happens before (or in the same DB transaction as) `orders.insert`; best-effort rollback at `:820-851` is removed.

### [ ] 2.8 — Validate `rentalEndDate >= eventDate`
- **Effort:** XS
- **Files:** `lib/checkout/actions.ts:331-342`, `components/checkout/CheckoutForm.tsx`
- **Done when:** reversed range is rejected with a clear error rather than silently clamping to 1 day.

### [ ] 2.9 — Remove the magic `$225` price default — `[migration]` `[breaking-ux]`
- **Effort:** S
- **Files:** `lib/checkout/actions.ts:314-315`, `lib/data/catalog-list.ts:111-114`, dashboard product list
- **Data audit:** how many products currently have `base_price IS NULL OR base_price = 0`? List them in the PR.
- **Decision:** hide from storefront, or refuse only at checkout?
- **Done when:** the `225` literal is gone; products with no price either don't appear or hard-fail checkout with "Pricing not set".

### [ ] 2.10 — Enforce service-area min order even when ZIP is missing
- **Effort:** S
- **Files:** `lib/checkout/actions.ts:261-287, 385`
- **Done when:** a delivery checkout with missing/invalid ZIP is rejected before pricing.

### [ ] 2.11 — Cancel-then-rebook race + cancel-removes-stops
- **Effort:** M
- **Files:** `lib/orders/actions.ts:792-807`, `lib/availability/actions.ts:200-220`, route stop deletion, `lib/crew/actions.ts`
- **Test:** cancelling an order in mid-route removes the stop from the crew app AND reopens availability atomically.
- **Done when:** above; lock per `(product_id, date)` during release+rebook.

### [ ] 2.12 — Refund auto-flip rounding-robust
- **Effort:** XS
- **Files:** `lib/payments/actions.ts:225-233`
- **Done when:** auto-flip uses integer cents (or an epsilon) so $99.99 refund on $100 order behaves as full refund.

### [ ] 2.13 — Deposit minimum clamp is visible to the customer
- **Effort:** XS
- **Files:** `lib/checkout/actions.ts:643-656`, `components/checkout/CheckoutSummaryCard.tsx`
- **Done when:** when the minimum is clamped, the summary card shows the configured minimum and the clamped amount side by side instead of silently substituting.

---

## Wave 3 — Onboarding & multi-tenancy

### [ ] 3.1 — Org switcher UI + active-org persistence — `[migration]`
- **Effort:** L (was M in v1 — cookie + membership flag + RLS interaction)
- **Files:** `components/layout/` (DashboardShell), new `components/auth/OrgSwitcher.tsx`, `lib/auth/org-context.ts:34-40` (accept active-org cookie or `memberships.preferred=true`), middleware
- **Migration:** backfill `preferred=true` to the existing first-org-by-`created_at` for current users.
- **Test:** user in 2 orgs can switch from sidebar; choice persists across sessions; RLS still enforces the chosen org.
- **Done when:** above.

### [ ] 3.2 — Onboarding resume affordance
- **Effort:** S
- **Files:** `app/onboarding/page.tsx`, `components/onboarding/OnboardingForm.tsx`, `middleware.ts:173-187`
- **Done when:** closing the tab mid-onboarding and reopening lands on a pre-filled form with a "Welcome back — finish setting up {orgName}" banner.

### [ ] 3.3 — Accept-invite reconciles with active org — `[blocks-on 3.1]`
- **Effort:** S
- **Files:** `lib/team/accept-invite.ts:44-49,84`, `lib/auth/org-context.ts:34-40`
- **Done when:** accepting an invite switches the active org to the invited org (or prompts with the switcher from 3.1); success message and dashboard agree.

### [ ] 3.4 — Resend verification email
- **Effort:** S
- **Files:** `app/login/page.tsx`, `lib/auth/actions.ts:269-322`
- **Done when:** login page shows "resend verification email" when the user is unverified; rate-limited per email.

### [ ] 3.5 — Demo-mode honest button state — `[breaking-ux]`
- **Effort:** S (broader scope than v1's 3.5)
- **Files:** `lib/onboarding/actions.ts:47-52`, `app/onboarding/page.tsx`, plus a sweep of every server action that returns `{ ok: true }` when `!hasSupabaseEnv()`
- **Done when:** in demo mode, buttons that no-op either (a) are disabled with a "Demo mode — connect Supabase to enable" tooltip, or (b) show a "saved locally only" badge after action.

### [ ] 3.6 — Setup checklist: clarify "does a draft count?" — `[decision]`
- **Effort:** XS once decided
- **Files:** `lib/guidance/checklist.ts:19-100`
- **Decision:** does a draft product count for "Add your first product"? Same question for service area, document template, etc.
- **Done when:** each `isComplete` predicate is decisive and matches its description text.

### [ ] 3.7 — Validate invite role on accept
- **Effort:** XS
- **Files:** `lib/team/accept-invite.ts:84`
- **Test:** invite row with unrecognized role → membership creation rejected.
- **Done when:** above.

### [ ] 3.8 — Welcome/tour state respects shared-machine reality
- **Effort:** S
- **Files:** `lib/guidance/actions.ts:66-74`, `components/guidance/welcome-modal.tsx`
- **Done when:** welcome state is per-user (already is) AND tour resumption logic doesn't auto-reopen if the user has subsequently dismissed and signed out.

### [ ] 3.9 — Rate-limit signup by IP and by email (typo guard)
- **Effort:** S
- **Files:** `lib/auth/actions.ts:237-250`
- **Done when:** a single IP can't spin up N unverified accounts within the window. Tunable.

---

## Wave 4 — Logistics & operator UX polish

### [ ] 4.1 — Calendar: events vs deliveries
- **Effort:** S
- **Files:** `lib/data/calendar.ts:56-76`, `components/calendar/`
- **Done when:** calendar has a toggle (or two layers) for `event_date` vs `route_date`.

### [ ] 4.2 — Calendar "+N more" is clickable
- **Effort:** XS
- **Files:** `components/calendar/month-grid.tsx:171-226`
- **Done when:** clicking opens a day-view modal listing every event.

### [ ] 4.3 — Stop scheduled times on the route kanban
- **Effort:** S
- **Files:** `app/dashboard/deliveries/[id]/page.tsx`, `app/dashboard/deliveries/page.tsx`, `components/deliveries/`
- **Done when:** each route card shows first/last scheduled times without opening detail.

### [ ] 4.4 — Disambiguate Orders / Calendar / Deliveries
- **Effort:** S
- **Files:** `lib/navigation/dashboard-nav.ts:27-31`, the three landing pages, help center
- **Done when:** each landing page has a one-liner subtitle and the help center cross-links them.

### [ ] 4.5 — Service-area lookup ambiguity visible to operator
- **Effort:** S
- **Files:** `lib/service-areas/lookup.ts:73-91`, `app/dashboard/service-areas/`
- **Done when:** dashboard surfaces "overlapping coverage" warnings; lookup uses a deterministic tie-breaker (tightest ZIP match, then most recently updated).

### [ ] 4.6 — Hardcoded timezone default
- **Effort:** XS
- **Files:** `components/onboarding/onboarding-form.tsx:208-213`
- **Done when:** default is derived from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with `America/New_York` as fallback only.

### [ ] 4.7 — Auto-reattach order to route on `event_date` change
- **Effort:** S
- **Files:** `lib/orders/actions.ts:595-645, 1021-1072`
- **Done when:** changing `event_date` moves the order off the old route and onto the new date's route.

### [ ] 4.8 — Resize / move the "Remove Stop" button
- **Effort:** XS
- **Files:** `components/deliveries/route-controls.tsx:133-170`
- **Done when:** Remove Stop is visually separated from action buttons (different row, destructive styling, or behind an overflow menu).

### [ ] 4.9 — Catalog availability per-hour (or document the date-only constraint)
- **Effort:** L
- **Files:** `lib/availability/window.ts:45-75`, `components/public/CatalogFilterForm.tsx`
- **Decision:** worth building the per-hour flow at all, or document "we book by day"? Most inflatable rentals are full-day, so default to "document" unless there's customer demand.
- **Done when:** either the time picker exists end-to-end, OR the catalog copy explicitly says bookings are by day.

### [ ] 4.10 — Checkout summary card refreshes when ZIP changes
- **Effort:** S
- **Files:** `app/checkout/page.tsx:117-122`, `components/checkout/CheckoutForm.tsx`
- **Done when:** ZIP change re-fetches pricing (delivery fee, service area minimum) before any final error.

---

## Snapshot view

- **Wave 1:** 8 items, mostly XS/S. Closes the worst noob traps in roughly a day of work.
- **Wave 2:** 13 items. Heaviest: 2.6 (multi-day routing, XL) and 2.7 (TOCTOU, L). Three are `[decision]`; three are `[migration]`; multiple `[breaking-ux]`.
- **Wave 3:** 9 items. Heaviest: 3.1 (org switcher, L).
- **Wave 4:** 10 items, all S/XS except 4.9 (per-hour availability, L — likely "document and skip").

If you only do one wave, do Wave 1. If you only do five items, do 1.4, 1.7, 1.8, 2.2, and 2.4 — those close the top five noob traps.
