# Pre-launch gaps — what the vertical walkthroughs miss

The 12-stage operator+customer walks (`tests/e2e/*.spec.ts`) cover
the **happy path** for all six day-one verticals — marketing →
signup → dashboard → product create + image upload → anonymous
storefront browse + checkout submit → operator-created order →
Mark Confirmed (with DB-truth reload). They do **not** cover the
classes of failures listed below. Most are not user-facing
features so much as *defensive surfaces* the SaaS needs in place
before the first real operator can take real money.

Severity: 🟥 **launch-blocker** · 🟧 **needed before scaling** · 🟨 **needed before SOC2 / GDPR posture**.

## 🟥 Launch-blockers (ship-stops)

1. **Cross-org isolation never end-to-end-tested.** Every action
   path uses `getOrgContext()` and `.eq("organization_id", …)`,
   but no test verifies that operator A signing in and guessing
   org B's order UUID gets a 404 instead of a 200 with cross-org
   data. RLS policies look right (`pg_policies` says `organization_id IN get_user_org_ids()`),
   but a regression there is silent until a customer screenshots
   someone else's name. Add a two-org spec that walks org A's
   operator through direct URLs for every org B resource (orders,
   products, customers, routes, route stops, documents, payments)
   and asserts 404 / 403 — not 200. `lib/auth/org-context.ts:89`.

2. **Operator new-order form doesn't require delivery address.**
   Stage 6 caught this — for `fulfillment_type='delivery'` the
   form lets the operator submit without an address, and the
   resulting order sits at `confirmed` and can never be routed
   (*"Add a delivery address before routing this order"*).
   `lib/validation/orders.ts:70-79`. **Real operators will create
   delivery orders without an address by accident and then call
   support.**

3. **Mark Completed has no UI.** `VALID_TRANSITIONS` allows
   `delivered → completed` but the dashboard never renders the
   button — Decision 2.2 note in `lib/orders/actions.ts:868`
   says a confirm modal is required, but it hasn't shipped.
   Operators have no way to close out the rental lifecycle.

4. **Storefront checkout never tested in non-English.** Operator
   UI supports en/es/fr/pt but `app/checkout/page.tsx` and the
   storefront PDP don't switch locale. A Spanish-speaking
   customer lands on an English checkout. Lost conversion at
   the highest-intent moment, in many of our day-one US markets.

5. **No "operator with zero service areas" guard.** If an
   operator publishes a product before adding a service area,
   the storefront renders "out of stock" or 500s on availability
   check (`lib/availability/check.ts`). Onboarding should block
   publish until at least one service area exists or surface a
   loud banner.

6. **No "operator with no Stripe keys" guard on checkout.**
   `hasStripeEnv()` returns false → action sends a 503 but the
   customer-facing message is generic. An operator who skips
   Stripe setup ships a broken storefront; customer abandons and
   leaves a 1-star review. Surface "deposit not yet wired" on
   the operator dashboard until Stripe is set up.

## 🟧 Scale-blockers (need before the first 100 customers)

7. **Webhook idempotency under retry storms.** Stripe webhook
   handler claims a dedup key (`app/api/stripe/webhooks/route.ts:75-84`)
   but releases on failure (line 693). Two concurrent retries
   can both clear the claim, send the same confirmation email,
   and only be saved by the unique index on
   `(order_id, provider_payment_id)`. Test with a deliberately
   re-played event; assert exactly one email + one payment row.

8. **Partial-refund reconciliation drops on Stripe API failure.**
   `charge.refunded` webhook iterates the `charge.refunds` list
   but falls back to the (possibly truncated) webhook payload if
   the API fetch fails (`app/api/stripe/webhooks/route.ts:382-390`).
   A partial refund could be recorded as a full one;
   `balance_due_amount` lies. Operators can't trust the
   balance sheet → trust break.

9. **Today-only delivery board.** `/dashboard/deliveries` filters
   to `route_date = today`. Future routes are invisible in the
   main list. An operator planning a Saturday on Wednesday has
   no way to see / re-open / edit / share that route from the
   surface they use daily.

10. **Auto-attach is silent.** `updateOrderStatus` auto-attaches
    a confirmed order to a matching-date route with no surface
    signal. Operators discover their order is on a route only
    when they next open it. Surface a toast or routing-card
    banner.

11. **Portal token revocation never verified end-to-end.** Stage
    8a creates docs, customer-side signing flow exists, but no
    test exercises the "operator revokes the customer's link" /
    "customer reaches portal with expired token" paths.
    `components/orders/revoke-portal-token-button.tsx`.

12. **Repeat-customer auto-fill is post-submit only.** Storefront
    doesn't pre-fill returning customers' details — the email
    ilike at `lib/checkout/actions.ts:957` runs *after* the form
    submits and silently updates the customer row. A returning
    customer has to retype their address every time. For repeat
    business this is friction.

13. **Crew mobile flow not tested in a mobile viewport.** Spec
    runs Chrome desktop 1280px. Crew uses phones in the field.
    Buttons may overflow, photo upload may break on small
    screens, signature pad may not render. Add a viewport
    override + walk the crew stop completion flow.

14. **Operator dashboard not tested below 1024px.** Same idea —
    operators check the dashboard from an iPad mid-event. A
    layout that hides Send-Delivery behind an overflow menu on
    tablet would only show up when an operator complains.

## 🟨 Compliance & operability (need before SOC2 / GDPR / first audit)

15. **Terms-acceptance audit trail never verified.**
    `lib/auth/actions.ts:346-361` records
    `terms_accepted_at` / `terms_version` / `terms_ip` on signup.
    No test confirms the row actually lands, the version is the
    current ToS, or the IP isn't user-supplied. Regulators will
    ask for this in an audit.

16. **Account deletion + 30-day PII purge cron untested.**
    `lib/account/delete-account.ts:124` soft-deletes the org;
    `app/api/cron/pii-purge/route.ts` runs the actual delete. No
    test confirms (a) the soft-deleted org is inaccessible
    immediately, (b) PII is actually scrubbed by the cron, (c)
    operator can't undo. GDPR requires this within 30 days; a
    silent cron failure is a regulatory exposure.

17. **Deposit-reminder cron never exercised.**
    `lib/email/triggers.ts:685-737` defines the trigger, fired
    by `app/api/cron/reminders/route.ts`. No test confirms the
    reminder actually sends, includes a fresh portal token, or
    avoids double-send on cron retry. Lost revenue if it
    silently fails.

18. **Stripe dispute / chargeback alert never tested.** Webhook
    handler logs disputes and creates a notification
    (`app/api/stripe/webhooks/route.ts:573-641`), but no test
    asserts the operator dashboard surfaces the alert. Operators
    have ~7 days to respond before losing the dispute; a missed
    notification = lost money + bad cardholder data.

19. **TOCTOU guard on status transitions untested concurrently.**
    `lib/orders/actions.ts:337-339` has the guard
    (`.eq("order_status", expected)`), but the test never
    simulates two near-simultaneous status writes (operator +
    webhook). A real concurrent transition could leave the
    order in a phantom state. Easy to script with a small
    concurrent-fetch test.

20. **`console.error` vs `logAppError` inconsistency.** Mixed
    usage means some errors never reach Sentry / app_error_logs
    (`lib/demo/guard.ts:27`, `app/api/stripe/webhooks/route.ts:61, 388, 415`).
    Add a lint rule or codemod converting all server-side
    `console.error(` to `logAppError(`. Otherwise silent
    failures rot in stdout.

21. **Soft-delete cascade on order cancellation untested.**
    Orders soft-delete via `deleted_at`; FK chains use
    `ON DELETE CASCADE`. No test confirms route_stops /
    payments / documents are properly handled when an order is
    cancelled vs hard-deleted. Orphaned `route_stops` on a live
    route corrupts the delivery board.

22. **Anon RLS on customer-facing reads.** Code explicitly
    flags this: `lib/portal/lookup.ts:76` —
    *"Same anon-RLS issue: order_items, documents, payments
    have no anon SELECT"*. Portal lookup falls back to the
    admin client. If the admin path is rate-limited or fails,
    customers see a misleading "Order not found" — and any
    edge in the policy could leak.

## Quick wins (small surface, real risk reduction)

- **A11y on storefront checkout.** `components/checkout/checkout-form.tsx`
  has `aria-live` on the alert banner but no field-error
  associations. Add `aria-describedby` on each input pointing at
  its `FieldError`. WCAG 2.1 AA is table-stakes; without it,
  disabled customers can't book and the operator catches the legal
  liability.
- **Transactional email locale.** Email templates exist in
  en/es/fr/pt but no test sends a non-English confirmation.
  Add one spec that creates a customer with
  `preferred_locale='es'` and asserts the rendered email body
  carries the Spanish template.

## Recommended next four specs

1. **`cross-org-isolation.spec.ts`** — two operators, two orgs;
   each tries every direct URL of the other and asserts 404 /
   403. (gaps #1, #22)
2. **`stripe-webhooks.spec.ts`** — replays `checkout.session.completed`
   and `charge.refunded` events with idempotency keys, asserts
   exactly-once side-effects. (gaps #7, #8)
3. **`onboarding-edge-cases.spec.ts`** — operator with 0 service
   areas, no Stripe, unverified email; each path renders a
   loud banner instead of silently shipping a broken store.
   (gaps #5, #6)
4. **`crew-mobile.spec.ts`** — iPhone 13 viewport, walks a stop
   from assigned → en_route → completed with photo + signature
   upload. (gap #13)

Each runnable independently against a dedicated `[E2E TEST]` org
so they can fan out in CI without colliding.
