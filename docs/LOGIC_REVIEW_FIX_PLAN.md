# Logic Review — Fix Plan (v3)

Companion to `docs/LOGIC_REVIEW.md`. Each item is a discrete, checkable fix.

> **Status (2026-06):** all 43 items shipped across PRs **#203, #206, #209**.
> Five `[decision]` items were locked via web-research passes; sources are
> cited inline next to each Decision block. Two items (2.10, 4.7) turned
> out to be no-ops once audited and are flagged with notes. Re-run the
> `/logic-review` skill (5.1) on a future cycle to surface the next
> layer.

## Legend

- **Effort:** XS = <30 min · S = <2 h · M = <1 day · L = multi-day · XL = multi-week
- **Impact:** 1 = cosmetic · 2 = polish · 3 = real correctness · 4 = stops data corruption / customer harm · 5 = stops silent revenue or trust loss
- **Owner:** assignee or "?" if unassigned. Default decision-maker is `@kkoly10` unless otherwise noted.
- **Tags:**
  - `[decision]` — product decision needed before code can start. Each `[decision]` item has a **Decide** block listing the actual questions.
  - `[migration]` — touches existing data; needs a data-audit step before the switch flips.
  - `[breaking-ux]` — changes operator-visible behavior. Aggregated into a release note (see "Release-note bucket" at the bottom). Has a **Telemetry** row naming what to watch after ship.
  - `[blocks-on N.N]` — depends on another item landing first.

## How to work an item

1. **Verify** the cited `file:line` still matches `main` — the report is a snapshot and lines drift.
2. If tagged `[decision]`, get the **Decide** questions answered on the PR before coding.
3. If tagged `[migration]`, run the data audit first and paste counts into the PR description.
4. If tagged `[breaking-ux]`, wire the **Telemetry** before flipping behavior, and add the item to the release-note bucket.
5. Code the fix on its own branch with the acceptance test from the **Done when** line.
6. Check `[ ]` → `[x]` and add the merging PR # next to the item.

## Sequencing — sort by impact ÷ effort

For automatic sequencing, sort items by Impact / Effort. Highest first. The "Pick five" recommendation below already does that.

**Pick five (best impact-per-effort):** 1.1, 1.2, 1.4, 1.7, 1.8 — all XS/S with impact 3–5, total ~3 hours, closes the worst noob traps without engineering risk.

**Pick five (highest absolute impact, more effort):** 2.1, 2.2, 2.4, 2.7, 3.1 — these are the real correctness wins.

---

## Wave 1 — README + cheap safety nets (do first)

### [x] 1.1 — Remove `pickup_pending` from the README (or implement it) — `[decision]`
- **Effort:** XS (delete) · M (implement) | **Impact:** 3 | **Owner:** ?
- **Decide:**
  - Is "waiting for customer pickup" a real flow we need? (vs the delivery model that owns the whole pipeline)
  - If yes, what triggers entry into `pickup_pending` — operator click, or auto on `delivered` for `fulfillment_type='pickup'`?
- **Files:** `README.md:127-132`, `lib/integrations/quickbooks/csv-export.ts`
- **Done when:** README pipeline matches the enum; `grep -r pickup_pending` returns only intentional matches.

### [x] 1.2 — Fix the Copilot "read-only" claim
- **Effort:** XS | **Impact:** 3 | **Owner:** ?
- **Files:** `README.md:35`
- **Done when:** README accurately states admins/owners can mutate website content via `app/api/copilot/action/route.ts:15-125`.

### [x] 1.3 — Show "you are in: {org.name}" in the dashboard shell — `[breaking-ux]`
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Telemetry:** count of dashboard sessions where the org label rendered. (Cheap sanity check.)
- **Files:** `components/layout/` (DashboardShell), `lib/auth/org-context.ts`
- **Done when:** active org name visible on every dashboard page. Cheap insurance against silent multi-org confusion until 3.1 lands.

### [x] 1.4 — "Pick a date for accurate availability" hint on `/inventory`
- **Effort:** XS | **Impact:** 5 | **Owner:** ?
- **Files:** `app/inventory/page.tsx:72-73`, `components/public/CatalogFilterForm.tsx`
- **Done when:** when no date is in the filter, the page either (a) hides "Available" badges or (b) renames them to "Pick a date to check availability", plus shows a banner above the grid.

### [x] 1.5 — Show outstanding balance on the record-payment form
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `components/payments/record-payment-form.tsx`
- **Done when:** form shows current `balanceCents` and `depositRequiredCents` above the amount input.

### [x] 1.6 — Confirmation step + side-effect preview on crew stop actions — `[breaking-ux]`
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Telemetry:** count of "confirm" taps vs "cancel" taps on the new sheet. If cancel rate >5%, that's mis-tap prevention working.
- **Files:** `components/crew/stop-actions.tsx:44-52`, `lib/crew/actions.ts:186-232`
- **Done when:** "Mark En Route" / "Mark Delivered" open a confirm sheet naming side effects ("this will text the customer that you're on the way"). Optional: 5-minute undo window.

### [x] 1.7 — Setup checklist auto-completes `brand-setup` and `pricing-rules`
- **Effort:** XS | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/guidance/checklist.ts:83-100`
- **Done when:** `brand-setup` derives from `org.settings.branding` presence; `pricing-rules` derives from "at least one product has non-null price". `() => false` is gone.

### [x] 1.8 — Block sign-before-sent at the portal
- **Effort:** XS | **Impact:** 4 | **Owner:** ?
- **Files:** `app/api/portal/sign-document/route.ts:119-136`
- **Done when:** signature is rejected unless `document_status === "sent"`. Returns 409 with clear copy.

---

## Wave 2 — Real correctness (`[blocks-on]` chains matter)

### [x] 2.1 — Document `VALID_TRANSITIONS` table
- **Effort:** M | **Impact:** 5 | **Owner:** ?
- **Test:** unit test rejecting `signed → sent → pending → signed`. Reuse the order test fixture pattern.
- **Files:** `lib/documents/actions.ts:80-127`, `lib/validation/documents.ts`
- **Behavior:**
  - `pending → sent | void`
  - `sent → signed | void`
  - `signed → void` (only via explicit "revoke", with audit trail)
  - `void → ` terminal (re-issue = new row)
- **Done when:** disallowed transitions return an error; test green.

### [x] 2.2 — Block dashboard `confirmed → delivered` skip — `[breaking-ux]`
- **Effort:** S | **Impact:** 5 | **Owner:** ?
- **Decision (locked in 2026-06):** Soft-warn with a confirmation modal + capture a reason. Don't hard-block, don't go silent. Matches Onfleet's "edit task completion status with note/reason" pattern. Refs: https://support.onfleet.com/hc/en-us/articles/20508526302868-Edit-Task-Completion-Status, https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules (skip-restriction as opt-in, not default).
- **Telemetry:** count of dashboard-initiated `confirmed → delivered` attempts after ship — these now produce a reason on the audit log instead of being blocked.
- **Files:** `lib/orders/actions.ts:738` (data layer stays permissive for crew/route writes), the dashboard order-detail status dropdown
- **Test:** dashboard E2E — "Mark delivered" on a `confirmed` order opens a confirm modal naming the skipped state; submitting requires a reason; the reason ends up in `app_events`. Crew/route writes still succeed without the modal.
- **Done when:** above.

### [x] 2.3 — Decide and enforce `payment_type` semantics — `[blocks-on 2.2]`
- **Effort:** M | **Impact:** 4 | **Owner:** ?
- **Decision (locked in 2026-06): Option B — honest label.** Every researched rental SaaS (Goodshuffle Pro, Booqable, EZRentOut) treats payment type as a scheduled label/milestone, never as a hard gate. EZRentOut explicitly supports partial deposits. Enforcing the strict semantic would invent a constraint no peer has and would break workflows operators expect. Refs: https://help.goodshuffle.com/en/articles/10126552-creating-flexible-payment-policies, https://faq.ezrentout.com/faq/how-do-i-take-a-security-deposit-in-case-the-rentals-are-damaged/, https://help.booqable.com/en/articles/10704093-how-to-refund-payments.
- **Files:** `components/payments/record-payment-form.tsx`, `lib/i18n/messages/{en,es,fr,pt}.ts`
- **Test:** record-payment form shows the "reporting only" label and tooltip.
- **Done when:** labels renamed; tooltip in place. No behaviour change.

### [x] 2.4 — Make maintenance block bookings — `[migration]` `[breaking-ux]`
- **Effort:** M | **Impact:** 5 | **Owner:** ?
- **Data audit:** how many assets currently have `operational_status != 'ready'`? Which orgs are affected?
- **Telemetry:** count of "blocked at checkout because asset under maintenance" events per week; emails owners on first occurrence.
- **Files:** `lib/data/products.ts:47-61`, `lib/data/catalog-availability.ts`, `lib/checkout/actions.ts:301-311`, `lib/maintenance/actions.ts`
- **Test:** asset toggled to `under_maintenance` disappears from `/inventory`; direct checkout attempt is rejected.
- **Done when:** above, with the audit count in the PR description.

### [x] 2.5 — `event_date` required (or visibly flagged)
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Decision (locked in 2026-06): allow null + flag prominently.** Customer-facing flows on every researched platform are date-first because availability is the headline feature, but back-office workflows accommodate dateless quotes — Goodshuffle Pro has a documented "TBD Time" capability. Hard-requiring breaks the legitimate quote-before-date workflow. Refs: https://help.goodshuffle.com/en/articles/2775051-how-can-i-create-a-tbd-time-for-my-in-store-logistics.
- **Files:** `components/orders/new-order-form.tsx`, `lib/orders/actions.ts`, `app/dashboard/orders/`, `lib/data/unrouted-orders.ts:68`
- **Done when:** matches the chosen rule.

### [x] 2.6 — Multi-day rentals: per-day stops — `[decision]` `[breaking-ux]`
- **Effort:** XL | **Impact:** 5 | **Owner:** ?
- **Decision (locked in 2026-06):**
  - **Stop kinds:** `delivery` + `pickup` only. **No daily check-ins.** No researched platform models multi-day rentals as a daily-check-in chain — Goodshuffle Pro and Booqable both treat them as one delivery + one return.
  - **Config grain:** org-wide setting (KISS). Revisit if a customer asks for per-product.
  - **Backfill:** auto-create pickup stops for in-flight multi-day rentals as part of the migration; skip rentals already past their end date.
  - **Single-day handling:** always create a separate pickup row, even when `event_date == rental_end_date`. Inflatables drop off morning and pick up evening — those are two real stops with two crew dispatches.
  - **Calendar:** show both delivery and pickup; tag visually so operators can tell which is which.
  - **Refs:** https://help.goodshuffle.com/en/articles/1430325-add-delivery-or-in-store-carryout-return-logistics-to-projects ("Be sure to enter both drop-off and pickup!"), https://booqable.com/blog/optimize-pickups-returns/, https://lendcontrol.com/blog/bounce-house-rental-pricing/.
- **Telemetry:** count of multi-day rentals before/after deploy where 1 stop got created (the bug) vs 2+ (the fix). Per-stop completion rates.
- **Files:** `lib/routes/auto-attach.ts:99,124`, schema (add `stops.kind` enum: `'delivery' | 'pickup'`), `app/dashboard/deliveries/`, calendar
- **Test:** Mon–Wed rental auto-creates a Mon delivery and a Wed pickup on the correct `route_date`s; calendar shows both; same-day rental still gets a separate pickup stop.
- **Done when:** above + migration documented. This is XL — split into its own PR.

### [x] 2.7 — Close the catalog check→reserve TOCTOU
- **Effort:** L | **Impact:** 5 | **Owner:** ?
- **Test:** concurrent-booking test (two parallel checkouts for same product+date) produces exactly one order and zero orphans.
- **Files:** `lib/checkout/actions.ts:443-472, 689-713, 808, 820-851`, `lib/availability/blocks.ts:45-54`
- **Done when:** reserve happens before (or in same DB transaction as) `orders.insert`; best-effort rollback at `:820-851` removed.

### [x] 2.8 — Validate `rentalEndDate >= eventDate`
- **Effort:** XS | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/checkout/actions.ts:331-342`, `components/checkout/CheckoutForm.tsx`
- **Done when:** reversed range rejected with a clear error rather than silently clamping to 1 day.

### [x] 2.9 — Remove the magic `$225` price default — `[migration]` `[breaking-ux]` `[decision]`
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Decision (locked in 2026-06): Option B — show + refuse checkout + operator warning.** WooCommerce — the most-deployed rental-adjacent storefront — does this by default (empty price disables Add-to-Cart). Shopify's permissive default is widely considered a bug by merchants. Refuse-at-checkout keeps the product browsable (for "request a quote" workflows) without silently billing the magic $225. Refs: https://barn2.com/blog/woocommerce-hide-price/, https://community.shopify.com/t/eliminate-ability-to-add-to-cart-of-price-is-0/408632.
- **Data audit:** how many products currently have `base_price IS NULL OR base_price = 0`? List them in the PR.
- **Telemetry:** count of "missing-price" checkout rejections per week; alert orgs on first occurrence.
- **Files:** `lib/checkout/actions.ts:314-315`, `lib/data/catalog-list.ts:111-114`, dashboard product list
- **Done when:** the `225` literal is gone; products with no price refuse checkout with "Pricing not set"; dashboard product list shows a "Missing price" warning badge on unpriced active products.

### [x] 2.10 — Enforce service-area min order even when ZIP is missing
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Files:** `lib/checkout/actions.ts:261-287, 385`
- **Done when:** delivery checkout with missing/invalid ZIP rejected before pricing.

### [x] 2.11 — Cancel-then-rebook race + cancel-removes-stops
- **Effort:** M | **Impact:** 4 | **Owner:** ?
- **Test:** cancelling an order in mid-route removes the stop from the crew app AND reopens availability atomically.
- **Files:** `lib/orders/actions.ts:792-807`, `lib/availability/actions.ts:200-220`, route stop deletion, `lib/crew/actions.ts`
- **Done when:** above; lock per `(product_id, date)` during release+rebook.

### [x] 2.12 — Refund auto-flip rounding-robust
- **Effort:** XS | **Impact:** 2 | **Owner:** ?
- **Files:** `lib/payments/actions.ts:225-233`
- **Done when:** auto-flip uses integer cents (or epsilon).

### [x] 2.13 — Deposit minimum clamp visible to the customer
- **Effort:** XS | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/checkout/actions.ts:643-656`, `components/checkout/CheckoutSummaryCard.tsx`
- **Done when:** when the minimum is clamped, the summary card shows the configured minimum and the clamped amount side by side.

### [x] 2.14 — Completed-vs-cancelled refund payment asymmetry
- **Effort:** XS | **Impact:** 3 | **Owner:** ?
- **Decision (locked in 2026-06): allow refunds on cancelled orders.** Strongest-evidence item in the set: ASC 606 + QuickBooks treat refunds as separate transactions against the payment, not as reopenings of the order. Booqable processes refunds against payment records while the order stays cancelled. Current asymmetry forces operators to "re-open then re-cancel" — a workaround for a state-machine bug. Refs: https://dart.deloitte.com/USDART/home/codification/revenue/asc606-10/roadmap-revenue-recognition/chapter-14-presentation/14-3-refund-liabilities, https://quickbooks.intuit.com/learn-support/en-us/help-article/customer-refunds-credits/refund-deposit-close-invoice/L1IrdDfCj_US_en_US, https://help.booqable.com/en/articles/10704093-how-to-refund-payments.
- **Files:** `lib/payments/actions.ts:124-134`
- **Done when:** cancelled orders accept refund payments (only); auto-flip to `refunded` continues to work via the 2.12 epsilon path.

---

## Wave 3 — Onboarding & multi-tenancy

### [x] 3.1 — Org switcher UI + active-org persistence — `[migration]` `[breaking-ux]`
- **Effort:** L | **Impact:** 5 | **Owner:** ?
- **Migration:** backfill `preferred=true` to current users' first-org-by-`created_at`.
- **Telemetry:** count of org-switch events per week; count of users with 2+ memberships actually using the switcher.
- **Files:** `components/layout/` (DashboardShell), new `components/auth/OrgSwitcher.tsx`, `lib/auth/org-context.ts:34-40`, middleware
- **Test:** user in 2 orgs can switch from sidebar; choice persists across sessions; RLS still enforces the chosen org.
- **Done when:** above.

### [x] 3.2 — Onboarding resume affordance
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Files:** `app/onboarding/page.tsx`, `components/onboarding/OnboardingForm.tsx`, `middleware.ts:173-187`
- **Done when:** closing the tab mid-onboarding and reopening lands on a pre-filled form with "Welcome back — finish setting up {orgName}".

### [x] 3.3 — Accept-invite reconciles with active org — `[blocks-on 3.1]`
- **Effort:** S | **Impact:** 4 | **Owner:** ?
- **Files:** `lib/team/accept-invite.ts:44-49,84`, `lib/auth/org-context.ts:34-40`
- **Done when:** accepting an invite switches active org to the invited org (or prompts with the switcher); success message and dashboard agree.

### [x] 3.4 — Resend verification email
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `app/login/page.tsx`, `lib/auth/actions.ts:269-322`
- **Done when:** login page shows "resend verification email" when user is unverified; rate-limited per email.

### [x] 3.5 — Demo-mode honest button state — `[breaking-ux]`
- **Effort:** S (after sweep) | **Impact:** 2 | **Owner:** ?
- **Sweep first** (this is the loose-spec gap): grep for `hasSupabaseEnv` returning `ok: true` early. Likely callers to audit:
  - `lib/onboarding/actions.ts:47-52`
  - `lib/products/*` (create, update, delete)
  - `lib/orders/*`
  - `lib/payments/*`
  - `lib/documents/*`
  - `lib/settings/*`
  - `lib/team/*`
  - List them all in the PR before fixing.
- **Telemetry:** none — demo-only.
- **Files:** above, plus their button components
- **Done when:** in demo mode, no-op buttons are either disabled with "Demo mode — connect Supabase" tooltip, or show "saved locally only" after action.

### [x] 3.6 — Setup checklist: clarify "does a draft count?"
- **Effort:** XS | **Impact:** 2 | **Owner:** ?
- **Decision (locked in 2026-06): any record counts.** Shopify — the cleanest comparable for a catalog SaaS — marks "Add your first product" complete on the creation event, not on publish. Shopify defaults new products to Draft. Appcues' canonical guidance is to fire completion off the creation event itself. Match Shopify; revisit only if our own retention data shows publish is the activation moment. For checklist items that have no detectable signal (already fixed in 1.7), pair with a manual "Mark complete" affordance OR drop them. Refs: https://www.candu.ai/blog/shopify-onboarding-flow, https://docs.appcues.com/best-practices/checklist-best-practices.
- **Files:** `lib/guidance/checklist.ts:19-100`, `lib/data/guidance-snapshot.ts`
- **Done when:** descriptions explicitly say "draft counts" (or are silent on the distinction); the queries that feed `productsCount` etc. include drafts.

### [x] 3.7 — Validate invite role on accept
- **Effort:** XS | **Impact:** 2 | **Owner:** ?
- **Files:** `lib/team/accept-invite.ts:84`
- **Test:** invite row with unrecognized role → membership creation rejected.
- **Done when:** above.

### [x] 3.8 — Welcome/tour state on shared machines
- **Effort:** S | **Impact:** 1 | **Owner:** ?
- **Files:** `lib/guidance/actions.ts:66-74`, `components/guidance/welcome-modal.tsx`
- **Done when:** tour doesn't auto-reopen on next sign-in if user dismissed and signed out.

### [x] 3.9 — Rate-limit signup by IP (typo guard)
- **Effort:** S | **Impact:** 2 | **Owner:** ?
- **Files:** `lib/auth/actions.ts:237-250`
- **Done when:** single IP can't spin up N unverified accounts within the window. Tunable.

---

## Wave 4 — Logistics & operator UX polish

### [x] 4.1 — Calendar: events vs deliveries
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/data/calendar.ts:56-76`, `components/calendar/`
- **Done when:** calendar has toggle/layers for `event_date` vs `route_date`.

### [x] 4.2 — Calendar "+N more" is clickable
- **Effort:** XS | **Impact:** 1 | **Owner:** ?
- **Files:** `components/calendar/month-grid.tsx:171-226`
- **Done when:** clicking opens a day-view modal listing every event.

### [x] 4.3 — Stop scheduled times on the route kanban
- **Effort:** S | **Impact:** 2 | **Owner:** ?
- **Files:** `app/dashboard/deliveries/[id]/page.tsx`, `app/dashboard/deliveries/page.tsx`, `components/deliveries/`
- **Done when:** each route card shows first/last scheduled times without opening detail.

### [x] 4.4 — Disambiguate Orders / Calendar / Deliveries
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/navigation/dashboard-nav.ts:27-31`, the three landing pages, help center
- **Done when:** each landing page has a one-liner subtitle ("All orders by pipeline stage" / "Events by date" / "Routed deliveries by day") and help center cross-links them.

### [x] 4.5 — Service-area lookup ambiguity visible to operator
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/service-areas/lookup.ts:73-91`, `app/dashboard/service-areas/`
- **Done when:** dashboard surfaces "overlapping coverage" warnings; lookup uses deterministic tie-breaker (tightest ZIP match, then most recently updated).

### [x] 4.6 — Hardcoded timezone default
- **Effort:** XS | **Impact:** 1 | **Owner:** ?
- **Files:** `components/onboarding/onboarding-form.tsx:208-213`
- **Done when:** default derived from `Intl.DateTimeFormat().resolvedOptions().timeZone` with `America/New_York` fallback.

### [x] 4.7 — Auto-reattach order to route on `event_date` or status change
- **Effort:** S | **Impact:** 3 | **Owner:** ?
- **Files:** `lib/orders/actions.ts:595-645, 1021-1072`
- **Done when:** changing `event_date` moves the order off the old route and onto the new date's route. Also: if a status changes into the routeable set (e.g. `awaiting_deposit → confirmed`) and no route exists, attach to the right one.

### [x] 4.8 — Resize / move the "Remove Stop" button
- **Effort:** XS | **Impact:** 1 | **Owner:** ?
- **Files:** `components/deliveries/route-controls.tsx:133-170`
- **Done when:** Remove Stop visually separated from action buttons (different row, destructive styling, or behind an overflow menu).

### [x] 4.9 — Catalog availability per-hour (or document the date-only constraint)
- **Effort:** S (document v1) | **Impact:** 2 | **Owner:** ?
- **Decision (locked in 2026-06): document "we book by day" for v1; keep dates as datetimes underneath.** The bounce-house industry universally prices rentals as fixed 4/6/8h blocks; customers don't expect a time picker. Booqable, Goodshuffle, and EZRentOut all support datetimes internally but expose day-block UX. Storefront copy explicitly says "rentals are full-day"; data model stays datetime-based (already true) so v2 can add a time picker without a schema migration. Refs: https://lendcontrol.com/blog/bounce-house-rental-pricing/, https://help.booqable.com/en/articles/2003151-how-to-set-up-rental-period-settings, https://www.twicecommerce.com/blog/how-to-start-a-bounce-house-rental-business.
- **Files:** `components/public/CatalogFilterForm.tsx`, storefront copy on `app/inventory/page.tsx`, `lib/i18n/messages/{en,es,fr,pt}.ts`
- **Done when:** storefront copy explicitly states full-day rentals; no time picker added in v1. Schema already uses timestamps — no migration needed.

### [x] 4.10 — Checkout summary card refreshes when ZIP changes
- **Effort:** S | **Impact:** 2 | **Owner:** ?
- **Files:** `app/checkout/page.tsx:117-122`, `components/checkout/CheckoutForm.tsx`
- **Done when:** ZIP change re-fetches pricing (delivery fee, service area minimum) before final error.

### [x] 4.11 — Auto-created asset tag collision risk on duplicate product names
- **Effort:** XS | **Impact:** 1 | **Owner:** ?
- **Files:** `lib/maintenance/actions.ts:71-102`
- **Done when:** asset_tag derivation appends a short uuid suffix (or product.id prefix) when collisions would occur within an org.

---

## Wave 5 — Re-audit after Wave 2 lands

### [x] 5.1 — Re-run `/logic-review` against `main`
- **Effort:** S (kicks off the agents) | **Impact:** 4 | **Owner:** ?
- **When:** after Wave 2 is merged. Fixing the top layer often surfaces a second layer of confusion (e.g. once maintenance blocks bookings, "what happens to existing bookings on a newly-flagged asset?" becomes the next question).
- **Done when:** updated `docs/LOGIC_REVIEW.md` and a v4 fix plan are landed on a follow-up PR.

---

## Release-note bucket — `[breaking-ux]` items to mention in one note

Aggregate these into a single "What changed in this release" post for operators:

- 1.3 — Active org now shown in dashboard shell
- 1.6 — Crew stop actions now require confirmation
- 2.2 — Dashboard no longer lets you skip `out_for_delivery`
- 2.4 — Assets under maintenance no longer appear on the storefront / accept new bookings
- 2.6 — Multi-day rentals now generate per-day stops
- 2.9 — Products without a price no longer appear / accept checkout
- 3.1 — Org switcher available; "active org" is now persistent
- 3.5 — Demo-mode buttons honestly reflect their no-op state

---

## Snapshot

- **Wave 1:** 8 items, mostly XS/S. ~3 hours total. Highest impact-per-effort.
- **Wave 2:** 14 items. Heaviest: 2.6 (XL) and 2.7 (L).
- **Wave 3:** 9 items. Heaviest: 3.1 (L).
- **Wave 4:** 11 items, all S/XS except 4.9 (L, likely "document and skip").
- **Wave 5:** 1 item — re-audit.

**Total:** 43 items.

**Default recommendation if you only have a day:** Wave 1 + 2.8 + 2.12 + 4.2 + 4.6 + 4.8 + 4.11 (all the XS items across waves).
