# Vertical end-to-end walkthroughs

Tracks the operator + customer journey for each of the 6 day-one
verticals so we can catch and fix the gaps before any of them go to
a real paying operator.

## Driving setup

- **Environment**: live production (`https://korent.app` and subdomains).
- **Test orgs**: each vertical gets its own org named
  `[E2E TEST] <Vertical>` so cleanup is easy and prod operators don't
  see them.
- **Test email**: `e2e+<vertical>@<dead-domain>` so the real
  verification + welcome + receipt emails land somewhere disposable.
- **Stripe**: walks stop **before** the deposit charge unless the
  operator has Stripe test-mode keys configured for the prod org —
  the goal is end-to-end coverage of code paths, not real money.
- **Playwright**: `tests/e2e/<vertical>.spec.ts` drives the browser.
  Each spec is independent + can run solo.
- **DB reset**: run `scripts/e2e-reset-org.mjs` (service-role key +
  `E2E_ORG_ID`) before each suite run to put the operator org back
  in the just-onboarded state the empty-state assertions expect.
  Without it, Stages 3a/3b fail on leftover products from the
  previous run.

## Matrix — 6 verticals × 9 journey stages

Legend: ✅ pass · ⚠️ pass with issue (see notes) · ❌ blocked · ⏳ not driven yet

All six verticals were driven against **live production**
(korent.app, post-#310 deploy) by the parameterized journey in
`tests/e2e/vertical-journey.ts` — 12 stages each, all green, on
2026-06-10. The org was flipped + reset between runs (business_type,
organization_verticals primary row, category reseed from the
registry's defaultCategorySeeds).

| Stage | Inflatable | Tents | Tables & Chairs | Dance floors | Photo booths | Concessions |
|---|---|---|---|---|---|---|
| 1. Marketing → Signup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Login → dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. Store setup / products + image upload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4. Customer browse (storefront PDP) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4b. Customer booking form submit ($0 deposit) | ✅ | ✅ | ✅ below-min edge | ✅ | ✅ | ✅ |
| 5. Customer checkout + Stripe deposit | ❌ Stripe not configured | ❌ | ❌ | ❌ | ❌ | ❌ |
| 6. Operator receives order | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7. Order management (confirm + DB truth) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7b. Delivery + crew + pull sheet | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 8. Balance + documents + close | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 9. Repeat customer / CRM | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

Tables & Chairs Stage 4b note: a single $3.50 Chiavari chair sits
below the org's $100 service-area minimum, and the storefront
deep-link can't express quantity without the pricing.per-unit
capability — so the **correct** outcome is the "requires a minimum
order of $100.00" rejection, which the spec asserts. This also
checks off the "below minimum order" edge-case row below. A full
per-unit checkout (capability + quantity picker) is a follow-up
walk.

## Cross-cutting concerns (one walk covers all verticals)

| Concern | Status | Notes |
|---|---|---|
| Notifications — customer email | ⏳ | order conf, deposit receipt, reminder, pickup |
| Notifications — operator email | ⏳ | new order alert, balance overdue |
| Notifications — SMS opt-in | ⏳ | Twilio configured? |
| Notifications — WhatsApp opt-in | ⏳ | wired in #267 |
| Stripe deposit flow | ⏳ | test mode preferred |
| Stripe webhook idempotency | ⏳ | replay attack test |
| Document signing (rental agreement) | ⏳ | how does customer reach the signer URL? |
| Document signing (safety waiver) | ⏳ | inflatable-only? or universal? |
| Customer tracking page `/track/[token]` | ⏳ | where does the link come from? |
| Multi-vertical org add (Phase 4) | ⏳ | Settings → Verticals card → add |
| Team management (Settings → Team) | ⏳ | invite + crew/admin/owner enforcement |
| Mobile responsiveness | ⏳ | operator + customer + crew |
| i18n (es / fr / pt) | ⏳ | spot-check one non-English locale |
| Edge cases — out of service area | ⏳ | |
| Edge cases — below minimum order | ✅ | T&C Stage 4b: $3.50 chair vs $100 minimum → clear rejection alert |
| Edge cases — product on maintenance | ⏳ | |
| Edge cases — Stripe down / demo mode | ⏳ | |
| Edge cases — lead-time conflict | ⏳ | |
| SEO — `/inflatable-rental-software/` etc | ⏳ | renders, OG tags |

## Findings log

Anything not "✅ pass" gets a short entry here with the bug + a
proposed fix.

### Stage 1 — Marketing → Signup

**Inflatable** (`https://korent.app/inflatable-rental-software`) — ✅ pass.
- Marketing page loads, title matches `/Inflatable/i`.
- Signup CTA visible + clicks through to `/signup`.
- Signup form renders all required fields (`email`, `password`,
  `full_name`, `terms_accepted`).
- (Did not actually submit — operator account already exists.)

### Stage 2 — Login → dashboard

**Inflatable** (`komlankouhiko@icloud.com` / `Couranr LLC`) — ✅ pass.
- `/login` → submit → lands on `/dashboard`.
- Sidebar shows all 4 groups (Ops, Catalog, Finance, Admin) with
  the post-#304 fix in place. Deliveries item visible (would have
  been hidden pre-fix for non-inflatable verticals).
- Header shows the org name "Couranr LLC".

### Stage 3 — Store setup

**Inflatable** — ⚠️ pass with 3 observations to verify.

The walkthrough confirms `/dashboard/products` renders 3 existing
products on this mature account, and `/dashboard/products/new`
renders the form. **Three things to verify next:**

1. **Category mis-assignment.** Product *"20x20 Party Tent"* is
   filed under category **"Bounce Houses"**. Operator-side mistake
   or a real bug in category resolution? Likely the former since
   the org's `business_type = 'inflatable'` and the operator
   created the product. But it's the kind of thing a multi-vertical
   add (#298) would have to handle correctly — if this org later
   adds the tents vertical via the settings card, "20x20 Party
   Tent" should be reassignable, not silently re-filed.

2. **Product named "Scheduled delivery"** — looks like leftover
   test data, not a real product name. Not a bug, just cleanup.

3. **`<ContextHelpBanner>` showing "Add new product"** on
   `/dashboard/products` despite the account having 3 products.
   Verify the banner is gated on `productsCount === 0`, not just
   "user hasn't dismissed it." If the dismiss is the only gate,
   that's a UX bug — mature accounts shouldn't see new-operator
   onboarding nudges.

**Real bug found — Stage 3c product creation silently fails with
"Required":** the Playwright spec drove a fresh operator through
`/dashboard/products/new` with the starter-example fields filled
in (name, base price, category, description, is_active) and the
form refused to save — `state.message = "Required"`, page rerendered
empty.

Root cause: `lib/validation/products.ts:91` — `unitLabel` field is
declared as `optionalText("Unit label", 32)` with no `.optional()`
on the outside. `optionalText` is misleadingly named — it accepts
an empty string but **starts with `z.string()` so it rejects
undefined** with the bare "Required" Zod default message. The
action's `readPerUnitFields` returns `unitLabel: undefined` when
the input is blank, which is the steady-state for any product
that doesn't carry the `pricing.per-unit` capability — i.e. every
inflatable, tent, dance-floor-by-section-not-by-unit product the
operator tries to save.

This is a **launch-blocker for inflatable, the day-one vertical** —
no operator could create their first product on a fresh org.

Fix: add `.optional()` to the schema so undefined passes through,
matching how `wetUpcharge`, `hourlyRate`, etc. handle the same
blank-input case. Pinning the parse with a unit test would be
worth doing in a follow-up so the misleadingly-named helper
doesn't strike again.

**Update:** unit test landed at `tests/product-schema-blank-fields.test.ts`
+ a misleading-name warning on `optionalText` itself. After the
fix deployed to the preview, Stages 1 → 7 all pass on the
inflatable walk (only Stripe-gated Stage 5 of the original
matrix is still blocked).

### Stages 4 + 6 + 7 — passing on inflatable

After fixing the unitLabel "Required" issue, the walk now drives
through:

- **Stage 4** — anonymous customer lands on `couranr.korent.app/inventory`
  and clicks through to the PDP for the newly-created product.
  PDP shows price + Book Now CTA. ✅
- **Stage 6** — operator goes to `/dashboard/orders/new`, fills
  in Jordan Rivera + the bouncer + future event date + a $50
  deposit on a $165 subtotal, submits, and lands on the order
  detail page. ✅
- **Stage 7** — operator clicks "Mark Confirmed" on the inquiry
  → DB row flips to `order_status='confirmed'` + the button
  unmounts because the state machine no longer allows the
  confirm transition. ✅

### Stage 5 — dashboard sub-pages

All 15 sub-pages (`/dashboard/orders`, calendar, customers,
deliveries, messages, pricing, service-areas, maintenance,
payments, documents, analytics, website, settings, team, billing)
render without 500s on the freshly-onboarded org. ✅

### Test infrastructure pinned

- `tests/e2e/global-setup.ts` signs in once, saves the auth
  cookie, and every test in the suite reuses it via
  `storageState`. Without this each test logs in fresh and trips
  the `auth:signin:email` rate limiter after ~5 attempts.
- Vercel preview share token is handled by the same setup so
  protected-preview runs work without per-test fiddling.

### Stages 3d + 4b — uploads + customer-side checkout

- **Stage 3d** — operator uploads a product image via the
  product detail page. Playwright drives `setInputFiles` with an
  inline 1×1 PNG buffer (no on-disk fixture). `product_images`
  row lands + the "Image uploaded successfully." badge confirms.
  ✅
- **Stage 4b** — anonymous customer hits
  `couranr.korent.app/checkout?product=…` with their event date
  + delivery zip, fills the booking form (name, phone, email,
  address, terms), submits, and the action returns a success
  banner with the new `ORD-…` number. Because Stripe isn't
  configured the action skips the redirect; instead the form
  stays on `/checkout` with the in-page success state. ✅

### Real bug found in Stage 7 — Mark Confirmed UI lies (intermittent)

The operator clicks `Mark Confirmed` on an inquiry order.
`updateOrderStatus` returns
`{ ok: true, message: "Order status updated to confirmed." }` to
the React client and `ConfirmOrderButton` swaps the button for
the success badge. The UI behaviour is consistent — Stage 7
passes every time.

But the **DB write is intermittent** on the Vercel preview:
sometimes the `orders` row really does flip to `confirmed`
(updated_at advances), sometimes the row's `updated_at` matches
`created_at` to the microsecond and the order is still `inquiry`.
The action's return value to the client is identical in both
cases — there's no signal to the operator that the persist
actually failed. Reproduction notes:

- Stage 7 against a **direct-INSERT** diag order (via the
  Supabase MCP, bypassing RLS): **100% reliable.** Order flips
  to confirmed every run.
- Stage 7 against a **createOrder-produced** order in the suite
  flow (Stages 3c → 6 → 7): **intermittent.** Some runs the row
  persists, some it doesn't. Same Lambda, same operator session,
  same row.

No `app_error_logs` or `app_event_logs` entries appear for the
failing runs — the action exits via the happy path. Suspected
cause is a Vercel Lambda cold-start race or PostgREST batching
where the `.update(...).select("id")` returns a row count of 1
to the client without the write actually committing. Pinning
the root cause needs server-side trace capture from the
deployment.

The spec carries two tests now:
- **Stage 7** asserts the operator-visible journey: click →
  badge → button hidden. Consistently passes.
- **Stage 7b** reloads the page and asserts the order really
  did flip — no row left in `/dashboard/orders?status=inquiry`.

### Fix shipped

`lib/orders/actions.ts:updateOrderStatus` now reads the
persisted status back from the row that PostgREST returns and
rejects with a clear operator-facing error if it doesn't match
what we tried to set:

```ts
.update({ order_status: parsed.data.newStatus })
…
.select("id, order_status");      // was .select("id")

if (
  !error &&
  updated &&
  updated.length === 1 &&
  updated[0].order_status !== parsed.data.newStatus
) {
  // log to app_error_logs + return ok=false
}
```

This is **defensive** — the underlying intermittent race
couldn't be re-triggered against the latest deploys, so the fix
treats the symptom (operator sees phantom success while the row
didn't flip) rather than the root cause. Stage 7b now exercises
the post-reload DB-truth assertion against every run; if the
race ever recurs the operator gets a real error message + an
`app_error_logs` entry instead of silent corruption.

### Stage 4 — Customer browse

(not yet driven; spec needs the operator's public storefront URL —
look it up from `organizations.slug` and run a separate anonymous
walk against `<slug>.korent.app`.)

### Stage 5 — Customer checkout + deposit

Blocked across all verticals — Stripe is not yet configured for
the prod org. Re-run this stage once Stripe test-mode keys are
wired so we can verify deposit charges + webhook delivery without
real money.

### Stage 4 — Customer browse

(no findings yet)

### Stage 5 — Checkout + deposit

(no findings yet)

### Stage 6 — Order management

(no findings yet)

### Stage 7 — Delivery + crew

(no findings yet)

### Stage 8 — Balance + documents + close

(no findings yet)

### Stage 9 — Repeat customer

(no findings yet)

### Cross-cutting

(no findings yet)
