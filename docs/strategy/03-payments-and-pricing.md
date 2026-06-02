# Payments & Pricing Strategy

**Date**: June 2026
**Question answered**: How should Korent price in USD and MXN, and what payment infrastructure is required for US and Mexico launches?

---

## Executive summary

Korent's recommended pricing — **Starter $49 / Pro $99 / Growth $199 USD** — prices Pro tier ~60% below Goodshuffle Pro's realistic $257/mo all-in while including features competitors charge extra for. For Mexico, both Stripe Mexico and Conekta require a **Mexican legal entity (SA de CV + RFC + CLABE)** with **2-4 month setup time** — this is the critical-path item for any Mexico launch. Because Korent's codebase is already Stripe-shaped, **Stripe Mexico is the lower-effort integration choice (~4 dev-days vs ~18 for Conekta)** once the entity is set up. Mexico's 2020 Digital Services Regime requires **IVA (16% VAT) registration within 30 days of first Mexican sale**, independent of entity status.

---

## 1. SaaS pricing benchmarks

### US pricing positioning

| Tier | Price (USD/mo) | What's included |
|---|---|---|
| Starter | $49 | 1 user, basic inventory + booking + email |
| **Pro** | **$99** | Multi-user, SMS, customer portal, white-label storefront, AI Copilot |
| Growth | $199 | Multi-location, advanced reporting, priority support |

vs. competitor "realistic monthly" pricing for a 2-user, 1-location party rental op:

| Tool | Realistic monthly | Notes |
|---|---|---|
| Goodshuffle Pro Standard + Website + QBO | **$257** | Their headline $99 (annual) hides $79 + $39 add-ons |
| InflatableOffice Basic + Website + CRM + Workers | **$293** | Their headline $39 is single-user, no online booking |
| Booqable Grow + Deliveries | $78 | But no SMS, no routing, no driver workflow |
| **Korent Pro** | **$99** | Everything included |

### Mexico pricing positioning

| Tier | Price (MXN/mo) | USD-equivalent |
|---|---|---|
| Inicial | $499 | ~$25 |
| Profesional | $1,200 | ~$60 |
| Empresarial | $2,400 | ~$120 |

Benchmarks:
- Mexican SMB SaaS pricing typically **30-50% of US prices** (Paddle/Monetizely regional pricing data — directional, not Mexico-specific)
- Slots beneath Eventrix's $599 MXN/user/mo on entry tier
- Matches EventControl Gold ($1,999 MXN) on top tier
- Localized MXN pricing matters: Paddle data shows companies with localized pricing grow ~2x faster

### Cultural billing considerations (Mexico)

- **Monthly billing only** — annual prepay has strong cultural resistance outside enterprise
- **Higher involuntary card churn (~2x US)** — Mexican SMB owners often use debit cards which fail recurring more often
- Offer SPEI customer-balance top-ups + OXXO as one-off fallback for cash-preferring customers

### Sources

- [Maxio 2025 SaaS Benchmarks](https://www.maxio.com/resources/2025-saas-benchmarks-report)
- [Monetizely Regional Pricing](https://www.getmonetizely.com/articles/regional-vs-global-saas-pricing-a-strategic-approach-to-pricing-optimization)
- [Paddle Localized Pricing](https://www.paddle.com/blog/saas-localized-pricing)
- [OpenView SaaS Benchmarks](https://openviewpartners.com/2023-saas-benchmarks-report/)
- [LAVCA 2025 Tech Trends](https://www.lavca.org/research/2025-lavca-trends-in-tech/)
- [Magma Partners on LatAm SaaS](https://magmapartners.com/post/how-magma-partners-thinks-about-saas-in-latin-america)

---

## 2. Stripe Mexico capabilities

### What Stripe MX supports

| Feature | Support | Notes |
|---|---|---|
| MXN card processing | ✅ | 3.6% + $3 MXN domestic, +1.5% intl card, +2% FX |
| **OXXO cash payments** | ✅ | MXN-only, 10-10,000 MXN per tx, next-business-day customer confirmation. **No recurring, no refunds, no disputes** — good for one-off event deposits, not for SaaS subscriptions |
| SPEI bank transfers | ✅ | Via Citibanamex partnership as "customer balance" — settles near-instantly 24/7/365, works for subscription top-ups |
| MXN payouts | ✅ | To Mexican CLABE only — **not to US bank account** |
| Stripe Tax (IVA collection) | ✅ Mexico only | LatAm tax auto-collection limited |

### What Stripe US (a US LLC's Stripe account) supports for Mexican customers

| Feature | Support | Notes |
|---|---|---|
| MXN card processing | ✅ | But ~7% effective rate (3.6% + 1.5% intl + 2% FX) |
| OXXO | ❌ | Not available |
| SPEI | ❌ | Not available |
| MXN payouts | ❌ | Get USD payouts (FX cost) |

### 🚨 Critical blocker: Stripe Mexico onboarding requires

1. **Mexican legal entity** (SA de CV)
2. **RFC** (Mexican tax ID) — requires physical presence + Mexican legal representative
3. **CLABE** Mexican bank account for MXN payouts

**Timeline**: 2-4 months with a Mexican lawyer/accountant.

Sources: [Stripe MX requirements](https://support.stripe.com/questions/required-information-to-open-your-stripe-account-in-mexico), [Stripe OXXO docs](https://docs.stripe.com/payments/oxxo), [Stripe SPEI docs](https://docs.stripe.com/payments/bank-transfers/acerca-de-transferencias-bancarias), [Stripe MX Pricing](https://stripe.com/en-mx/pricing)

---

## 3. Conekta as alternative (analyzed and not recommended)

### Conekta API capabilities

- **Auth**: API key based, separate sandbox/production
- **OXXO**: First-class support, async webhook (hours/days)
- **SPEI**: First-class, returns CLABE, webhook on settlement
- **Cards**: Tokenized client-side via Conekta.js
- **Subscriptions**: Native (Plans + Subscriptions + trial_end + pause/resume + retry). **Cards only for recurring** — OXXO/SPEI are one-off
- **Webhooks**: 30+ event types, signature verification, retries 13× over 24h on non-2XX
- **Fees**: ~3.6% + $2.50 MXN cards, ~3.9% + $3.50 MXN OXXO, ~$5 MXN flat SPEI (must be reconfirmed — /precios page returned 404)

### Stripe-vs-Conekta API gotchas

- **No hosted Checkout** as polished as Stripe Checkout
- **No Billing Portal** — must build custom self-serve cancel/upgrade UI (~2 dev-days)
- APMs (OXXO/SPEI) are **asynchronous** — order must remain "awaiting payment" until webhook arrives (could be days). Stripe-shaped flow that assumes immediate `payment_intent.succeeded` will break
- Amounts in **MXN cents** only, currency fixed to MXN
- No equivalent of `Stripe.Price` — Plan = price + product collapsed
- Event payload schema differs (snake_case)

### 🚨 Same blocker: Conekta requires Mexican RFC + CLABE for merchant signup

A US LLC alone cannot onboard. Mitigation: incorporate a Mexican entity. This is **the same critical-path item as Stripe Mexico** — no time saved by switching processors.

### Why Stripe Mexico beats Conekta for Korent

| Factor | Stripe Mexico | Conekta |
|---|---|---|
| Entity required | Mexican (SA de CV + RFC + CLABE) | Mexican (SA de CV + RFC + CLABE) |
| Codebase fit | ✅ Already Stripe-shaped | ❌ Build new adapter |
| Dev effort | **~4 days** | **~18 days** |
| Billing Portal | ✅ Hosted | ❌ Build custom (~2 days) |
| OXXO | ✅ | ✅ |
| SPEI | ✅ | ✅ |
| Subscriptions | ✅ Mature | ✅ |
| Tax (IVA) collection | ✅ Stripe Tax MX | ❌ Manual |

**Verdict**: Use Stripe Mexico. The only reason to switch to Conekta is if Stripe MX denies the merchant application — confirm with both vendors in writing during the entity-setup window.

---

## 4. IVA tax obligation

Mexico's 2020 Digital Services Regime applies to all foreign digital service providers selling to Mexican customers:

- **IVA (16% VAT) registration required within 30 days of first Mexican sale**
- Foreign digital providers are generally **exempt from CFDI issuance** but must withhold/remit IVA
- This is independent of having a Mexican entity — applies even to a US LLC selling to one Mexican customer
- Budget a Mexican accountant retainer **~$300 USD/mo** to handle filings

Sources: [Get Sphere Mexico IVA](https://www.getsphere.com/blog/mexico-iva), [Edicom CFDI](https://edicomgroup.com/blog/cfdi-electronic-invoicing-mexico)

---

## 5. Conekta integration plan (for reference if needed)

If Stripe Mexico denies the application, fall back to Conekta. Plan:

### Codebase changes (12 files affected)

| File | Role |
|---|---|
| `lib/stripe/config.ts` | SDK init, plan tiers, format |
| `lib/stripe/actions.ts` | SaaS subscription checkout + billing portal |
| `lib/stripe/subscription.ts` | DB-backed plan reader |
| `lib/stripe/gate.ts` | Feature-flag based on plan tier |
| `app/api/stripe/webhooks/route.ts` | Webhook handler (~600 lines) |
| `lib/checkout/actions.ts:626-980` | Customer-facing deposit checkout |
| `lib/portal/pay-balance.ts` | Customer balance payment |
| `components/settings/plan-selector.tsx` | UI |
| `components/settings/subscription-status-card.tsx` | UI |
| `components/settings/billing-portal-button.tsx` | UI |
| `components/checkout/checkout-form.tsx` | UI |
| `components/portal/pay-balance-button.tsx` | UI |

### Architecture: introduce `PaymentProvider` interface

```ts
// lib/payments/provider/types.ts (new)
export interface PaymentProvider {
  id: "stripe" | "conekta";
  createCustomer(input): Promise<{ customerId: string }>;
  createSubscriptionCheckout(input): Promise<{ url: string; sessionId: string }>;
  createOneTimeCheckout(input): Promise<{ url: string; sessionId: string }>;
  createBillingPortal(input): Promise<{ url: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<NormalizedEvent>;
  refund(input): Promise<void>;
}
```

Implementations: `lib/payments/provider/stripe.ts` (extracted) + `lib/payments/provider/conekta.ts` (new).

### Database schema additions

```sql
alter table organizations
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists conekta_customer_id text,
  add column if not exists conekta_subscription_id text;

create table if not exists conekta_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
```

(`payments.provider` and `payments.provider_payment_id` already exist in `supabase/migrations/20260324_120000_initial_schema.sql:182-183` — schema is partially generic-ready.)

### Tenant-level provider selection

```ts
// lib/payments/provider/select.ts
export async function getProviderForOrg(orgId) {
  const { payment_provider, default_currency } = await fetchOrg(orgId);
  if (payment_provider === 'conekta') return conektaProvider;
  if (payment_provider === 'stripe') return stripeProvider;
  return default_currency === 'mxn' ? conektaProvider : stripeProvider;
}
```

### Effort estimate (Conekta path)

| Phase | Days |
|---|---|
| Provider interface extraction + Stripe refactor (no behavior change) | 3 |
| Conekta SDK wrapper + customer/charge/refund | 2 |
| Conekta subscriptions + plans + seed script | 3 |
| Webhook endpoint + signature verify + normalized event handler refactor | 2 |
| Schema migration + provider selection + onboarding wiring | 1 |
| Custom self-serve billing UI (no Conekta portal equivalent) | 2 |
| Async OXXO/SPEI order-state handling | 2 |
| Playwright + sandbox tests | 2 |
| Buffer / docs / env wiring | 1 |
| **Total** | **~18 days** |

### Effort estimate (Stripe Mexico path)

Once the codebase already calls Stripe and the merchant entity is set up:

| Phase | Days |
|---|---|
| Enable MXN currency + OXXO payment method in checkout flow | 1 |
| Update webhook handler for OXXO async settlement | 1 |
| Spanish UI confirmation strings (already i18n-ready) | 0.5 |
| Stripe Tax MX configuration (IVA) | 0.5 |
| Playwright tests | 1 |
| **Total** | **~4 days** |

**Stripe MX wins by 14 dev-days.**

---

## 6. Competitor Mexican payment processors landscape

For reference / sales conversations:

- **Mercado Pago** — consumer-recognized brand, native OXXO + installments, B2C trust. For B2C event deposits, expect customer requests for MP. Fees comparable to Stripe, better local conversion.
- **Conekta** — Mexican-native, OXXO/SPEI first-class for subscriptions. Often recommended over Stripe for Mexico-first SaaS — but same entity requirement.
- **Clip** — primarily card-present/POS, less relevant for SaaS.
- **Openpay** (BBVA-owned) — 2.9% + $0.30 USD, 1-2 day settlement, broader LatAm.

Sources: [Atempora Stripe vs MP vs Conekta](https://atempora.studio/blog/stripe-vs-mercado-pago-vs-conekta), [MuralPay Mexico Gateways](https://muralpay.com/blog/top-payment-gateways-in-mexico-fees-settlement-fx)

---

## 7. Decision flowchart for Mexico launch

```
Want to launch in Mexico?
  ↓
Step 1: Mexican entity setup (SA de CV + RFC + CLABE)
  → 2-4 months, $5-10k USD legal/accounting cost
  → REQUIRED for both Stripe MX and Conekta
  ↓
Step 2: Register for IVA (Mexico Digital Services Regime)
  → Within 30 days of first MX sale
  → Required regardless of entity status if selling to MX customers
  ↓
Step 3: Pick processor
  → Stripe Mexico (RECOMMENDED — 4 dev-days)
  → Fallback: Conekta (18 dev-days, if Stripe MX denies)
  ↓
Step 4: Wire in payment methods
  → Card (recurring subscription)
  → SPEI (customer balance top-ups for subscription)
  → OXXO (one-off only — event deposits, never SaaS recurring)
  ↓
Step 5: Localize
  → Spanish UI (already i18n-ready)
  → MXN pricing tiers ($499 / $1,200 / $2,400)
  → Monthly-only billing
```

---

## 8. Sources

- [Stripe Mexico Required Info](https://support.stripe.com/questions/required-information-to-open-your-stripe-account-in-mexico)
- [Stripe OXXO docs](https://docs.stripe.com/payments/oxxo)
- [Stripe SPEI docs](https://docs.stripe.com/payments/bank-transfers/acerca-de-transferencias-bancarias)
- [Stripe Mexico Pricing](https://stripe.com/en-mx/pricing)
- [Stripe Tax LatAm](https://docs.stripe.com/tax/supported-countries/latin-america-and-caribbean)
- [Photonpay Stripe Mexico Review](https://www.photonpay.com/hk/blog/article/stripe-mexico?lang=en)
- [Conekta Developer Docs](https://developers.conekta.com/)
- [Atempora Stripe vs MP vs Conekta](https://atempora.studio/blog/stripe-vs-mercado-pago-vs-conekta)
- [MuralPay Mexico Gateways](https://muralpay.com/blog/top-payment-gateways-in-mexico-fees-settlement-fx)
- [PPRO Mexico E-commerce](https://www.ppro.com/insights/mexicos-e-commerce-and-digital-payments-growth-era/)
- [Mexico Business News Online Payments](https://mexicobusiness.news/ecommerce/news/mexicos-online-payments-credit-cards-lead-wallets-surge)
- [Get Sphere Mexico IVA](https://www.getsphere.com/blog/mexico-iva)
- [Edicom CFDI Mexico](https://edicomgroup.com/blog/cfdi-electronic-invoicing-mexico)
- [Maxio 2025 SaaS Benchmarks](https://www.maxio.com/resources/2025-saas-benchmarks-report)
- [Monetizely SaaS Pricing](https://www.getmonetizely.com/articles/saas-pricing-benchmark-study-2025-key-insights-from-100-companies-analyzed)
- [Paddle Localized Pricing](https://www.paddle.com/blog/saas-localized-pricing)
