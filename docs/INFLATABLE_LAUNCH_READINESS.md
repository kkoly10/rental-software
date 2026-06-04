# Inflatables — Launch-Readiness Walkthrough

**Purpose**: end-to-end manual test the operator can do on a real
Vercel deployment + live Supabase to confirm the inflatable vertical
is shippable to a paying customer. Each section is a sequence of
real actions, with expected outcomes and the failure-mode signal.

This is not a unit-test substitute — those run in CI. This is the
"actually open a browser and click through" checklist. If every
section passes, the inflatable product is launch-ready.

**Estimated time**: 60-90 minutes for a thorough single pass.

**Prerequisites**:
- A test Supabase project (or a dev branch off the live one) with all
  current migrations applied
- A test Stripe account in test mode (`sk_test_...`)
- A test Twilio account + a Twilio phone number (for SMS opt-in)
- A test Resend account + verified sender (for email confirmations)
- Browser dev tools open the whole time so you can spot 500s in the
  network tab as you go

---

## Section 0 — Pre-flight (5 min)

Before clicking anything, confirm these env vars are set in the
Vercel project (Production environment):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_DOMAIN`, `SITE_URL`
- [ ] `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
      `STRIPE_WEBHOOK_SECRET`, and the 6 `STRIPE_*_PRICE_ID` values
- [ ] `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] `CRON_SECRET` (so the daily crons fire)
- [ ] `EMAIL_VIEW_SECRET`

Reference: `docs/strategy/05-vertical-roadmap.md` and the full env
list in `.env.example`.

Also confirm:

- [ ] Wildcard DNS `*.korent.app` points to Vercel (so
      `<tenant>.korent.app` resolves)
- [ ] Stripe webhook endpoint configured to
      `https://korent.app/api/stripe/webhooks` with the 5 events from
      the deployment guide
- [ ] Twilio inbound webhook configured on the test number to
      `https://korent.app/api/twilio/inbound`

If any of the above is missing, stop here. Sections below assume all
of this is wired.

---

## Section 1 — Operator signup + onboarding (10 min)

The first 10 minutes of a new operator's life with Korent.

1. [ ] Go to `https://korent.app/signup` in an incognito window
2. [ ] Enter a new email + password + business name
3. [ ] Confirm the verification email lands in inbox within 30 sec
4. [ ] Click the verification link
5. [ ] Lands on `/onboarding` — confirm the page renders without
      console errors
6. [ ] Pick the **vertical chooser** option `Inflatables & party rentals`
      from Step 1
7. [ ] Fill in business name, slug (e.g. `test-1234`), timezone,
      primary ZIP, default delivery fee, order minimum
8. [ ] Submit. Should redirect to the success panel showing
      `https://test-1234.korent.app`
9. [ ] Click through to the storefront — confirm it loads (will show
      placeholder catalog)
10. [ ] Confirm welcome email arrived in inbox within 60 sec

**Pass criteria**: operator can self-serve onboard end-to-end without
ever needing to touch the SQL editor or contact support.

**Likely failure modes** (and where to look):
- Verification email doesn't land → check Resend dashboard for
  delivery failures, check `app_error_logs` table for
  `source='email.send'`
- Slug subdomain doesn't resolve → DNS wildcard not propagated
- Onboarding form errors out → check `app_error_logs` for
  `source='onboarding'`

---

## Section 2 — Create first inflatable product (10 min)

The first product an operator adds. Tests the operator-side of
Sprint 6.0 (anchoring + wet/dry).

1. [ ] In the dashboard, go to Products → "Create product"
2. [ ] Pick category `Bounce House` (an inflatable category)
3. [ ] Confirm the **Inflatable setup (optional)** accordion appears
      at the bottom of the form
4. [ ] Expand the accordion
5. [ ] Tick `Stakes` and `Sandbags` for anchoring methods
6. [ ] Enter `6` for required anchors
7. [ ] Tick both `Dry` and `Wet` modes
8. [ ] Enter `50` for wet upcharge
9. [ ] Set the product base price to `300`, name it "Test Tropical Combo"
10. [ ] Save. Confirm redirect to `/dashboard/products/<id>?created=1`
11. [ ] Re-open the same product — confirm the accordion is now
       **auto-expanded** (because it has wet enabled + anchoring set)
12. [ ] Confirm all the fields persisted correctly
13. [ ] Uncheck `Wet`, save, re-open. Confirm:
       - `Wet` checkbox is unchecked
       - The wet upcharge field is BLANK (orphan-clear rule working)
14. [ ] Re-enable `Wet`, set upcharge back to `50`, save

**Pass criteria**: the operator sees a clean form with optional
fields they can ignore, and the system preserves their config
without surprises.

**Likely failure modes**:
- Accordion doesn't appear → category vertical isn't `inflatable`
  (check `categories.vertical` for the picked category)
- Wet upcharge persists after unchecking Wet → `reconcileWetUpcharge`
  bug
- Form crashes on save → schema mismatch with validation Zod schema

---

## Section 3 — Customer storefront browsing (5 min)

A would-be customer arrives at the storefront.

1. [ ] Open `https://test-1234.korent.app/` in a separate incognito
      window
2. [ ] Confirm the homepage renders with the operator's branding
3. [ ] Click `Browse rentals` (or equivalent)
4. [ ] Confirm the "Test Tropical Combo" appears in the catalog
5. [ ] Click into the product
6. [ ] Confirm the **wet/dry radio cards** appear (both modes were
       enabled)
7. [ ] Confirm prices show: dry `$300.00`, wet `$350.00`
8. [ ] Toggle between dry and wet — confirm the selection visually
       moves
9. [ ] Click `Book Now` while wet is selected
10. [ ] Confirm the URL contains `?mode=wet` after redirect

**Pass criteria**: a customer who's never seen Korent can see what's
for rent, what it costs in either mode, and start a booking.

**Likely failure modes**:
- Radio cards don't appear → catalog detail isn't returning
  `supports_modes`
- Wet price shows $300 not $350 → `wetUpchargeCents` not loaded into
  `CatalogDetail` or `BookNowWithMode` not adding it to display

---

## Section 4 — Customer checkout (10 min)

The actual booking flow.

1. [ ] On the checkout page (continuing from Section 3 with wet mode
       pre-selected), fill in customer info (first, last, email,
       phone)
2. [ ] Tick the SMS opt-in checkbox
3. [ ] Fill in delivery address (street, city, state, ZIP)
4. [ ] Pick event date 2 weeks out, start time 11:00, end time 18:00
5. [ ] Click Continue / Review
6. [ ] On the review screen, confirm:
       - Item line shows "Test Tropical Combo"
       - **Subtotal** line shows `$300.00` (base price, NOT $350)
       - **Wet mode upcharge** line shows `+$50.00` (only because
         wet was selected)
       - **Delivery fee** shows `$25.00`
       - **Total** shows `$375.00` (300 + 50 + 25)
       - The line items visually add up to the total
7. [ ] Click Confirm. Should redirect to Stripe Checkout
8. [ ] Enter Stripe test card `4242 4242 4242 4242`, any future
       expiry, any CVC, any ZIP
9. [ ] Submit payment
10. [ ] Should redirect to order-confirmation page showing the order
        number
11. [ ] Confirm order-confirmation email arrives in customer inbox
12. [ ] Confirm SMS confirmation arrives on the customer phone (if
        you used a real number)

**Pass criteria**: a customer can pay a deposit and walk away with a
confirmed booking and proof in their inbox.

**Likely failure modes**:
- Display math wrong → check `subtotal - wetUpchargeApplied`
  computation in `lib/checkout/actions.ts`
- Stripe redirect fails → `STRIPE_*_PRICE_ID` or
  `STRIPE_WEBHOOK_SECRET` misconfigured
- Email doesn't land → Resend domain not verified
- SMS doesn't land → Twilio number not configured for outbound

---

## Section 5 — Operator dashboard after booking (10 min)

Operator switches back to the dashboard and sees the new order.

1. [ ] Refresh `/dashboard/orders`
2. [ ] Confirm the new order appears at the top with status
       `Confirmed` (deposit was paid via Stripe)
3. [ ] Click into the order
4. [ ] Confirm the item line shows:
       - `Test Tropical Combo (Wet) - Bring: Steel stakes (grass),
         Sandbags ×6`
       - The mode badge AND the Bring: line are both rendered
5. [ ] Confirm the financials show: total $375, deposit paid, balance
       due
6. [ ] Click the customer's name → confirm the customer page loads
       with their info
7. [ ] Go back to the order, click "Send delivery" (or equivalent
       dispatch button)
8. [ ] Confirm the route stop gets created (visible in
       `/dashboard/deliveries`)

**Pass criteria**: the operator can see exactly what was booked,
what they owe, and dispatch the delivery without confusion.

**Likely failure modes**:
- `Bring:` line shows raw `stakes,sandbags` instead of friendly
  labels → `formatInflatableItemLine` not being called or labels
  not loaded
- Mode badge missing → `order_items.selected_mode` is null in DB
  (check the actual row)

---

## Section 6 — Crew workspace (10 min)

The crew member opens the today page on their phone.

1. [ ] Sign in as a `crew` role user (you may need to invite a
       second test user with the crew role)
2. [ ] Open `/crew/today` on a phone or in mobile-emulation mode
3. [ ] Confirm the route stop appears
4. [ ] Confirm the per-stop card shows:
       - `Test Tropical Combo (Wet) - Bring: Steel stakes (grass),
         Sandbags ×6`
5. [ ] Tap into the stop
6. [ ] Confirm the delivery photo upload button appears
7. [ ] Upload a test photo from camera roll
8. [ ] Confirm the photo persists and shows on the stop after refresh
9. [ ] Sign the signature pad with finger/mouse
10. [ ] Mark stop as Completed
11. [ ] Repeat for the pickup-type stop (if a pickup was auto-created)

**Pass criteria**: the crew member can complete a delivery + pickup
without needing the operator to walk them through it.

**Likely failure modes**:
- `Bring:` line missing → route-detail.ts query not including
  `products(anchoring_methods, required_anchor_count)`
- Photo upload fails → `SUPABASE_SERVICE_ROLE_KEY` not set, or the
  `uploads` storage bucket doesn't exist

---

## Section 7 — Customer portal (5 min)

The customer can self-serve mid-rental.

1. [ ] Open the email confirmation from Section 4
2. [ ] Click the "View your order" or portal link
3. [ ] Confirm the portal page loads with order details
4. [ ] Confirm the customer can see the pricing breakdown including
       the wet upcharge line (mirrors the operator's view)
5. [ ] If the order is past-delivery: confirm the
       equipment-condition photos section shows the delivery photo
6. [ ] Try to pay the remaining balance via the portal
7. [ ] Confirm second Stripe redirect → second payment confirms →
       balance goes to $0

**Pass criteria**: customer doesn't need to call/email the operator
for status updates or balance payments.

**Likely failure modes**:
- Portal token expired → `PORTAL_TOKEN_MAX_AGE_DAYS` too low
- Photo not visible → cross-tenant RLS or anonymized URL issue

---

## Section 8 — Reverse flows (10 min)

What happens when things change.

1. [ ] As operator, cancel the test order via dashboard
2. [ ] Confirm the order status flips to `Cancelled`
3. [ ] Confirm the route stop is removed from
       `/dashboard/deliveries`
4. [ ] Confirm a refund is NOT auto-issued (manual refund flow is
       separate — check that the operator sees a "remaining deposit
       owed back" indicator)
5. [ ] As customer (test phone), reply `STOP` to the SMS
6. [ ] Confirm `customers.sms_opt_in` flips to false in DB
7. [ ] Try to create another order with the same email — confirm SMS
       confirmation does NOT send (but email + order still works)

**Pass criteria**: TCPA compliance + cancellation cleanup work.

---

## Section 9 — Spot checks (5 min)

Anything that's easy to forget but breaks demos badly.

1. [ ] Visit `<tenant>.korent.app` from a different tenant's
       perspective. From an incognito window, attempt a direct
       PostgREST call with the public anon key:

       ```bash
       curl "https://<your-supabase>.supabase.co/rest/v1/products?select=*" \
         -H "apikey: <ANON_KEY>"
       ```

       Without the `x-storefront-slug` header, should return `[]`.
       With the header (`-H "x-storefront-slug: test-1234"`), should
       return only that tenant's products. **This validates the RLS
       fix from PR #196.**

2. [ ] Open the Supabase advisor:
       `https://supabase.com/dashboard/project/<id>/advisors/security`
       and confirm no NEW critical issues since the last review.

3. [ ] CI is green on `main` branch on GitHub.

4. [ ] Sentry dashboard is empty (or shows only known issues) for
       the last 24 hours.

---

## Acceptance

If every box above is checked, the inflatable vertical is launch-ready
for paying customers. Move on to the **vehicles & fleet** vertical
(per `docs/strategy/05-vertical-roadmap.md`).

If any section fails, file an issue, fix it, re-run that section.
Don't ship with unchecked boxes — the cost of a broken first
customer experience is much higher than the cost of an extra hour of
testing.

## Out of scope for this walkthrough

These are explicitly NOT tested here because they have their own
specialized verification flows:

- **Multi-day rentals + pricing rules** — covered by checkout-flow
  smoke tests in `tests/smoke/`
- **Recurring booking series** — covered by `tests/series-cadence.test.ts`
- **QuickBooks / Xero sync** — covered by reconcile cron + their
  respective sandboxes
- **Route auto-optimization** — covered by `tests/route-optimizer.test.ts`
  and requires a real Mapbox token
- **WhatsApp Business** — requires Meta template approval, walk
  through separately once the templates are live
