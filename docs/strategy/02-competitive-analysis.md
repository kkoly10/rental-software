# Competitive Analysis: Feature Audit & Master Matrix

**Date**: June 2026
**Question answered**: What features does Korent have vs Goodshuffle Pro, Booqable, InflatableOffice? Where can we win, draw, or lose?

---

## Executive summary

Korent already matches or beats Goodshuffle Pro on most table-stakes features (inventory, e-sign, Stripe, multi-location, RBAC) **and** already ships features Goodshuffle is missing entirely: SMS via Twilio, customer self-serve portal, white-label subdomains, AI Operator Copilot, Spanish UI, weather alerts, crew mobile workspace, proof of delivery. Goodshuffle Pro's realistic monthly cost ($178-258 with required add-ons) is **2.6× Korent's Pro tier ($99)**, while Korent includes the white-label site Goodshuffle charges $79/mo extra for. The clearest wedge is positioning Korent as "everything Goodshuffle Pro charges extra for, included — plus SMS, portal, AI, and bilingual UI they don't have at all."

Booqable is cheaper ($78 realistic) but generic — no party-rental routing, no SMS, no driver workflow. InflatableOffice has 25 years of inflatable-specific feature depth (wet/dry, sandbag fees, route auto-optimization, native driver app) and 4.9/5 ratings — hardest to displace in their core niche.

**Recommended target: Goodshuffle Pro.**

---

## 1. Korent codebase feature inventory

Methodology: full audit of `/home/user/rental-software` — app/ routes, app/api/ endpoints, lib/ modules, supabase/migrations, components/, scheduled tasks, integrations. 89 features identified (71 production-ready, 13 partial, 5 stub).

### A. Inventory Management

| Feature | Status | File Pointer |
|---|---|---|
| Product catalog (CRUD) | ✅ Production | `app/dashboard/products/page.tsx` |
| Hierarchical categories | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:66` |
| Product images gallery (Supabase Storage) | ✅ Production | `lib/products/image-upload-actions.ts` |
| Product attributes & specs | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:106` |
| Asset serialization (VIN/asset tags) | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:114` |
| Asset operational status | ✅ Production | `lib/assets/operational-status.ts` |
| Asset condition tracking | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:122` |
| Maintenance records | ✅ Production | `app/dashboard/maintenance/page.tsx` |
| Inventory visibility (public/hidden) | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:93` |
| Bundles / kits / packages | ❌ Not built | — |
| Barcoding / QR | ❌ Not built | — |
| Pools / Set Asides / Sub-rentals | ❌ Not built | — |

### B. Booking / Reservation

| Feature | Status | File Pointer |
|---|---|---|
| Online public catalog | ✅ Production | `app/inventory/page.tsx` |
| Product detail pages | ✅ Production | `app/inventory/[slug]/page.tsx` |
| Availability checking | ✅ Production | `lib/data/catalog-availability.ts` |
| Availability blocks (blackout dates) | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:154` |
| Public checkout flow (multi-step) | ✅ Production | `app/checkout/page.tsx` |
| Multi-day rental pricing | ✅ Production | `lib/data/checkout-pricing.ts` |
| Order status pipeline (10 states) | ✅ Production | `lib/data/orders.ts` |
| Recurring booking | 🟡 Schema only | — |
| Setup/teardown buffers | 🟡 Partial | `lib/data/catalog-availability.ts` |

### C. CRM / Customers

| Feature | Status | File Pointer |
|---|---|---|
| Customer database | ✅ Production | `app/dashboard/customers/page.tsx` |
| Customer addresses (multiple per customer) | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:53` |
| Customer order history (nested) | ✅ Production | `app/dashboard/customers/page.tsx` (detail view) |
| Communication history logging | ✅ Production | `supabase/migrations/20260403_050000_communication_log.sql` |
| Customer portal (token-based self-serve) | ✅ Production | `app/order-status/page.tsx` |
| Repeat customer tracking | ✅ Production | `lib/data/analytics.ts:31` |
| Customer preferred locale | ✅ Production | `supabase/migrations/20260601_040000_customers_preferred_locale.sql` |

### D. Payments / Billing

| Feature | Status | File Pointer |
|---|---|---|
| Manual payment recording (cash/check/card/Venmo/Zelle/transfer) | ✅ Production | `app/dashboard/payments/page.tsx` |
| Deposit + balance tracking | ✅ Production | `lib/data/order-detail.ts` |
| Stripe integration (online payments) | ✅ Production | `lib/stripe/config.ts` |
| Refunds / partial refunds | ✅ Production | `lib/data/order-detail.ts` |
| Auto-confirm on full payment | ✅ Production | `app/api/stripe/webhooks/route.ts` |
| SaaS subscription billing (own product) | ✅ Production | `lib/stripe/config.ts` |
| Plan-based feature gating | ✅ Production | `lib/stripe/gate.ts` |
| Invoice PDF generation (jsPDF) | ✅ Production | `lib/invoices/generate-pdf.ts` |
| Tax calculation | 🟡 Partial | `lib/data/checkout-pricing.ts:25` (no state rules) |
| Multi-currency | 🟡 Schema only | `supabase/migrations/20260324_120000_initial_schema.sql:9` |
| Buy Now Pay Later (Affirm) | ❌ Not built | — |

### E. Contracts / Documents

| Feature | Status | File Pointer |
|---|---|---|
| Rental agreement PDF generation | ✅ Production | `lib/documents/generate-pdf.ts` |
| Safety waiver generation | ✅ Production | `lib/documents/generate-pdf.ts` |
| Document status tracking (draft/sent/signed) | ✅ Production | `app/dashboard/documents/page.tsx` |
| E-signature UI (canvas-based) | ✅ Production | `components/portal/document-sign.tsx` (react-signature-canvas) |
| Quote PDF generation | ✅ Production | `lib/quotes/generate-pdf.ts` |
| Quote-to-order conversion | ✅ Production | `lib/quotes/actions.ts` |

### F. Logistics / Delivery

| Feature | Status | File Pointer |
|---|---|---|
| Delivery board (kanban) | ✅ Production | `app/dashboard/deliveries/page.tsx` |
| Route management | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:177` |
| Route stops with sequence | ✅ Production | `supabase/migrations/20260324_120000_initial_schema.sql:188` |
| Driver assignment (TOCTOU-safe RPC) | ✅ Production | `lib/crew/actions.ts` |
| Crew mobile workspace | ✅ Production | `app/crew/today/page.tsx` |
| Stop status updates (en_route → delivered → completed) | ✅ Production | `supabase/migrations/20260602_030000_crew_stop_action_rpcs.sql` |
| Route auto-complete | ✅ Production | `lib/crew/actions.ts` |
| Proof of delivery (photos + signatures) | ✅ Production | `supabase/migrations/20260602_050000_crew_proof_rpcs.sql` |
| Delivery time windows | 🟡 Partial | `supabase/migrations/20260327_010000_service_area_availability_support.sql` |
| Route optimization (solver) | 🟡 Stub | `app/dashboard/deliveries/route-map-wrapper.tsx` |
| Loading lists / pull sheets | ❌ Not built | — |

### G. Communications

| Feature | Status | File Pointer |
|---|---|---|
| Email notifications (Resend) | ✅ Production | `lib/email/send.ts` |
| Email templates (lifecycle) | ✅ Production | `lib/email/templates.ts` |
| Email retry outbox | ✅ Production | `supabase/migrations/20260602_020000_email_outbox.sql` |
| Email view-in-browser (signed tokens) | ✅ Production | `lib/email/send.ts` |
| **SMS notifications (Twilio)** | ✅ Production | `lib/sms/provider.ts` |
| SMS templates | ✅ Production | `lib/sms/templates.ts` |
| Cron-driven reminders | ✅ Production | `app/api/cron/reminders/route.ts` |
| Deposit reminder emails | ✅ Production | `app/api/cron/reminders/route.ts` |
| Weather alerts via SMS | ✅ Production | `lib/sms/templates.ts` (OpenWeatherMap) |
| In-app messaging (crew ↔ dispatcher) | ✅ Production | `supabase/migrations/20260402_020000_messages_and_notifications.sql` |
| Notification inbox | ✅ Production | `app/dashboard/messages/page.tsx` |
| WhatsApp Business API | ❌ Not built (greenfield wedge) | — |

### H. Reporting / Analytics

| Feature | Status | File Pointer |
|---|---|---|
| Revenue dashboard | ✅ Production | `lib/data/analytics.ts` |
| Order metrics | ✅ Production | `lib/data/analytics.ts` |
| Customer metrics | ✅ Production | `lib/data/analytics.ts` |
| Revenue by month chart | ✅ Production | `lib/data/analytics.ts` |
| Top products report | ✅ Production | `lib/data/analytics.ts` |
| Busiest days analysis | ✅ Production | `lib/data/analytics.ts` |
| CSV export | ✅ Production | `components/export/*` |
| Analytics pagination | 🟡 Hard limits | `lib/data/analytics.ts:9` (5000 orders, 10000 payments) |
| Utilization reports | ❌ Not built | — |

### I. Multi-tenancy / Team

| Feature | Status | File Pointer |
|---|---|---|
| Organization scoping | ✅ Production | `lib/auth/org-context.ts` |
| **Multi-tenant subdomains + custom domains** | ✅ Production | `supabase/migrations/20260401_010000_custom_domain_support.sql` |
| User roles (Owner/Admin/Dispatcher/Crew/Viewer) | ✅ Production | `lib/team/actions.ts` |
| Role-based access control | ✅ Production | `lib/team/actions.ts` |
| Team member invitations (email + token) | ✅ Production | `supabase/migrations/20260330_020000_team_invites.sql` |
| Multi-location (service areas) | ✅ Production | `app/dashboard/service-areas/page.tsx` |
| Row-Level Security (RLS) | ✅ Production | `supabase/migrations/20260325_010000_rls_policies.sql` |

### J. Integrations

| Feature | Status | File Pointer |
|---|---|---|
| Stripe payments | ✅ Production | `lib/stripe/config.ts` |
| Resend email | ✅ Production | `lib/email/client.ts` |
| Twilio SMS | ✅ Production | `app/api/twilio/inbound/route.ts` |
| Weather API (OpenWeatherMap) | ✅ Production | `lib/weather/api.ts` |
| Sentry error tracking | ✅ Production | `lib/observability/server.ts` |
| QuickBooks / Xero | ❌ Not built | — |
| Google Calendar / Outlook | ❌ Not built | — |
| Zapier webhooks | ❌ Not built | — |
| Public API | ❌ Not built | — |

### K. Unique / Differentiating

| Feature | Status | File Pointer |
|---|---|---|
| **AI Operator Copilot** (context-aware, Pro+ only) | ✅ Production | `app/api/copilot/route.ts` |
| Onboarding flow | ✅ Production | `app/onboarding/page.tsx` |
| Guided tour (8-step) | ✅ Production | `lib/guidance/tour-config.ts` |
| Setup checklist (10-item) | ✅ Production | `lib/guidance/checklist.ts` |
| Context help banners | ✅ Production | `components/guidance/context-help-banner.tsx` |
| Help Center (18 articles) | ✅ Production | `app/dashboard/help/page.tsx` |
| Calendar view (orders) | ✅ Production | `app/dashboard/calendar/page.tsx` |
| Homepage website builder | ✅ Production | `app/dashboard/website/page.tsx` |
| Brand/logo upload | ✅ Production | `lib/settings/brand-upload-actions.ts` |
| **i18n with Spanish translations** | ✅ Production | `lib/i18n/server.ts` |
| **Demo mode (fallback data)** | ✅ Production | `lib/env/demo-mode.ts` |
| Rate limiting | ✅ Production | `supabase/migrations/20260326_020000_rate_limits.sql` |
| Account deletion + PII purge cron | ✅ Production | `lib/account/delete-account.ts` + `app/api/cron/pii-purge/route.ts` |
| Reengagement email cron | ✅ Production | `app/api/cron/reengagement/route.ts` |
| Storage cleanup cron | ✅ Production | `app/api/cron/storage-sweep/route.ts` |
| Availability holds cleanup | ✅ Production | `app/api/cron/cleanup-holds/route.ts` |

### Korent's notable strengths

1. **Operator-centric guidance system** — 8-step guided tour + context-aware help banners + 18-article Help Center + setup checklist
2. **AI Copilot with knowledge-base fallback** — context-aware (knows current route, page topic), gracefully degrades when API keys missing
3. **Atomic crew-action RPCs** — TOCTOU-safe via row locking, prevents unassigned crew from completing stops after reassignment
4. **Multi-tenant subdomains + custom domains** — operators get white-labeled storefronts
5. **Proof-of-delivery infrastructure** — photo + signature capture per stop, stored atomically
6. **Email + SMS + in-app messaging trinity** — consistent templates, retry queues, operator toggles

### Korent's gaps (P0 / P1 / P2)

**P0 (must close for credible Goodshuffle comparison)**:
- QuickBooks Online integration
- Route auto-optimization (one-click solver)
- Pull sheets / loading lists

**P1 (differentiation)**:
- WhatsApp Business API (greenfield — nobody has it)
- Damage waiver fees, sandbag/anchoring fees, capacity fees (IO-style)
- Public API + Zapier app
- Recurring bookings UI (schema ready)

**P2 (nice-to-have)**:
- Native mobile app for operators (responsive web works for now)
- Avalara/TaxJar tax automation
- Utilization / LTV reporting
- Pools / Set Asides / Sub-rentals (Goodshuffle Standard features)

---

## 2. Goodshuffle Pro audit

**Pricing**: Lite $39/user/mo, Standard $99 (annual) / $139 (monthly) + add-ons. Website Integration $79/mo, QuickBooks Online $39/mo, additional users $19-49/mo.

**Realistic 2-user, 1-location party rental op with online booking + QBO**:
- Standard $139 + Website $79 + QBO $39 = **$257/mo** (monthly billing)
- $178/mo (annual billing, no QBO)

**Customer base**: "thousands of customers" per Series A announcement Feb 2024. 157 Capterra reviews, 4.8/5, 99% small-company reviewers, 75% Event Services.

### Top 5 strengths

1. Inventory & conflict detection (4.7/5)
2. Stripe electronic payments + "sign & pay" flow (4.8/5)
3. E-sign contracts & quote-to-cash (4.7/5)
4. QuickBooks Online integration (Intuit-certified, deep two-way sync)
5. Customer support (4.9/5, live chat + dedicated onboarding)

### Top 5 weaknesses (from reviews)

1. **Steep setup learning curve**, especially inventory configuration
2. **No native mobile app** — mobile web only
3. **No SMS, no WhatsApp, no public API/Zapier, no Xero**
4. **"Basic" CRM** — Advanced CRM only arriving Q1 2026
5. **Pricing perceived high** for small operators; nickel-and-dime add-ons

### What customers ask for that's NOT included

- Native iOS/Android mobile app
- SMS / text customer notifications
- **True customer self-service portal** (still "coming soon")
- Public REST API + webhooks + Zapier
- Xero integration
- International credit card acceptance + intl phone fields
- Customizable email templates
- Customer LTV / cohort reporting
- Automated booking confirmation
- Vendor marketplace
- Staffing / labor scheduling
- 24/7 weekend support

Source: [pro.goodshuffle.com/features](https://pro.goodshuffle.com/features/), [Capterra](https://www.capterra.com/p/167364/Goodshuffle-Pro/), [Lite vs Standard](https://pro.goodshuffle.com/blog/goodshuffle-pro-lite-vs-standard-comparison)

---

## 3. Booqable audit

**Pricing**: Start $29, Grow $69, Scale $149, Custom $349+. Add-ons: Website Builder $19-24, Deliveries $9, Mobile POS $9-12/user.

**Realistic 2-user, 1-location party rental op with online booking + Stripe**:
- Grow $69 + Deliveries $9 = **$78/mo** (with own WP/Shopify site)
- With Booqable's website builder + POS: ~$115-130/mo

**Customer base**: Dutch HQ, expanding US. Strong EU customer base.

### Top 5 strengths

1. Clean booking UI & online checkout
2. Easy website embed across WP/Shopify/Squarespace/Webflow
3. Wide payment processor support (40+ methods, no booking commission)
4. Responsive chat support
5. E-signatures built-in

### Top 5 weaknesses

1. **Feature gating drives bill up fast** — bundles, advanced reports, website builder, deliveries, POS, multi-location all behind tiers or add-ons
2. **No automatic recurring monthly payments** — manual workaround for long-term rentals
3. **Delivery routing weak** — per-mile fees don't auto-calc at checkout; no multi-stop routing
4. **Bulk edit & webstore customization limited**
5. **Mobile app less functional than desktop**

### What customers ask for that's NOT included

- Multi-stop driver routing & route optimization
- Delivery time windows / driver dispatch app
- Standalone digital waivers separate from rental contract
- **Native SMS / WhatsApp**
- Recurring billing for monthly rentals
- Native QuickBooks integration (Zapier only)
- US sales-tax jurisdiction automation
- Assigning staff to specific locations
- LTV / cohort analytics

Source: [booqable.com/features](https://booqable.com/features/), [booqable.com/pricing](https://booqable.com/pricing/), [Capterra Booqable](https://www.capterra.com/p/138689/Booqable/reviews/)

---

## 4. InflatableOffice audit

**Pricing**: Starter $39 (10 items), Basic $124 (35 items), Plus $164 (100 items), Elite $264 (250 items). Website/API +$39, plus 5 separate add-ons ($50-65 each).

**Realistic 2-user, 1-location inflatable op**:
- Basic $124 + Website $39 = **$163/mo** (bare minimum)
- Typical: Basic + Website + CRM $65 + Workers $65 = **$293/mo**

**Customer base**: 2,000+ companies. Capterra 4.9/5 (75 reviews).

### Top 5 strengths

1. One-click routing + auto gas/labor cost calculation
2. Contract + e-sign + damage-waiver flow
3. Inflatable-specific inventory (wet/dry dual-listing, multi-unit obstacle components, sandbag/capacity fees)
4. WordPress-owned website + SEO + auto-generated area landing pages
5. Customer support ("always someone there")

### Top 5 weaknesses

1. **Steep learning curve** — "intimidating," cited in nearly every negative review
2. **Workers module not user-friendly** — recurring complaint, $65 add-on
3. **Add-on model feels nickel-and-dimed** — headline $39 is unrealistic
4. **Dated/cluttered UI**
5. **Mobile/native gaps** for operator side (driver app exists for crews)

### Unique inflatable-specific features (hard to replicate)

- Damage waiver fees, sandbag/anchoring fees, max-capacity fees as native line items
- Wet/dry dual-listing of the same physical inflatable
- Multi-unit obstacle course component tracking
- Mod art-panel inventory
- NWS wind/rain weather alerts to staff
- Maryland amusement tax + Canada GST native support
- Auto gas/labor cost computation on optimized routes
- WordPress-owned site model with auto area landing pages
- IO Workers driver mobile app (iOS/Android)
- Insurance discount program for IO customers

Source: [inflatableoffice.com/features](https://inflatableoffice.com/features), [Capterra IO](https://www.capterra.com/p/135628/InflatableOffice/)

---

## 5. Master feature matrix

| Capability | Korent | Goodshuffle Pro | Booqable | InflatableOffice |
|---|:---:|:---:|:---:|:---:|
| **Inventory** | | | | |
| Catalog, photos, conflict detection | ✅ | ✅ | ✅ | ✅ |
| Pools / Set Asides / Sub-rentals | ❌ | ✅ Standard | ❌ | partial |
| Barcoding | ❌ | ✅ Standard | ✅ add-on | ❌ |
| Asset serialization/condition | ✅ | partial | ❌ | ✅ |
| Wet/dry dual-listing, capacity/sandbag fees | ❌ | ❌ | ❌ | ✅ unique |
| **Booking** | | | | |
| Online booking widget | ✅ included | ✅ +$79/mo | ✅ Grow tier | ✅ +$39/mo |
| Customer self-serve portal | ✅ | ❌ "coming soon" | ✅ | ✅ |
| Recurring booking | ❌ (schema only) | ❌ | ❌ | ✅ |
| Multi-day pricing, setup buffers | ✅ / partial | ✅ Standard | ✅ | ✅ |
| **Payments** | | | | |
| Stripe + deposits + balance | ✅ | ✅ | ✅ | ✅ multi-processor |
| Buy Now Pay Later (Affirm) | ❌ | ✅ | ❌ | ❌ |
| Tax automation | partial | ✅ | EU VAT only | ✅ TaxCloud |
| Multi-currency | schema only | partial | ✅ EU-first | partial |
| **Contracts / e-sign** | ✅ canvas-based | ✅ | ✅ | ✅ + DocuSign |
| Damage waiver workflow | ✅ template | ✅ | weak (Zapier) | ✅ flagship |
| **Logistics** | | | | |
| Delivery board / route mgmt | ✅ | ✅ Standard | weak ($9 add-on) | ✅ |
| Driver mobile workspace | ✅ responsive web | ❌ no mobile | ❌ | ✅ native app |
| Route auto-optimization | ❌ (stub) | ✅ Standard | ❌ | ✅ flagship |
| Proof of delivery (photo/sig) | ✅ | partial | ❌ | ✅ |
| Pull sheets / loading lists | ❌ | ✅ | ✅ | ✅ |
| **Communications** | | | | |
| Email automation | ✅ | ✅ | ✅ | ✅ |
| **SMS native** | ✅ **Twilio** | ❌ "coming soon" | ❌ Zapier only | ✅ |
| **WhatsApp** | ❌ (opportunity) | ❌ | ❌ | ❌ |
| Weather alerts | ✅ unique | ❌ | ❌ | ✅ |
| In-app messaging | ✅ | ✅ | ❌ | ✅ |
| **Reporting** | | | | |
| Revenue + order dashboards | ✅ | ✅ | ✅ | ✅ |
| Utilization / LTV | ❌ | weak | weak | weak |
| CSV export | ✅ | weak (reduced) | ✅ | ✅ |
| **Team & multi-tenancy** | | | | |
| RBAC (4 roles) | ✅ | ✅ Standard | ✅ Grow | ✅ |
| Multi-location | ✅ included | ✅ | ✅ +$29-37/loc | ✅ +$50/mo |
| **Subdomain + custom domain (white-label)** | ✅ **included** | ❌ widget only | weak | ❌ (WP own-site) |
| **Integrations** | | | | |
| QuickBooks | ❌ | ✅ +$39/mo certified | ❌ Zapier only | ✅ Desktop+Online |
| Xero | ❌ | ❌ | ✅ beta | ❌ |
| Zapier / public API | ❌ | ❌ | ✅ | ✅ |
| Google Calendar | ❌ | ✅ | ❌ | ✅ |
| **Unique to Korent** | | | | |
| AI Operator Copilot | ✅ **only** | ❌ | ❌ | ❌ |
| i18n / Spanish UI | ✅ included | ✅ new 2026 | ❌ | ❌ |
| Demo mode (no DB) | ✅ unique | ❌ | ❌ | ❌ |

---

## 6. Pricing comparison (apples-to-apples)

| Tool | Plan needed | Required add-ons | **Real monthly** |
|---|---|---|---|
| Goodshuffle Pro | Standard $139 | Website $79 + QBO $39 | **$257** |
| InflatableOffice | Basic $124 | Website $39 + CRM $65 | **$228** |
| Booqable | Grow $69 | Deliveries $9 | **$78** (but no SMS, no routing) |
| **Korent Pro** | **$99** | **(everything included)** | **$99** |

Korent's Pro tier already prices below the realistic stack of Goodshuffle and IO while including SMS, portal, white-label, and AI that Goodshuffle is missing entirely.

---

## 7. Why target Goodshuffle Pro

1. **Highest-value displacement** — $257/mo realistic vs Korent's $99/mo = 2.6× price gap, easy ROI conversation
2. **Most exploitable gaps** — missing SMS, customer portal, native mobile, public API, Xero, WhatsApp, AI. Korent has 5 of those 7 working
3. **Customers complain about exactly what Korent does well** — review themes: "expensive once add-ons stack," "no mobile," "no SMS," "weak CRM"
4. **Their website widget is $79 add-on** — Korent's white-label subdomain + custom domain is a stronger story (real site, not embed)
5. **They've raised $5M and target the mid-market** — moving up, not down. The solo-operator / $50-300k revenue segment they're abandoning is Korent's buyer

### Why not Booqable

Already cheap ($78 realistic). Hard to undercut on price. Their weakness is being generic (not party-specific), but Korent isn't yet "party-specific enough" to win that fight cleanly without closing IO-tier inflatable gaps.

### Why not InflatableOffice

25 years of inflatable-specific depth, 4.9/5 rating, 2,000+ customers. Hard to displace in core niche. Avoid head-on unless Korent goes vertical-deep on bouncy castles (wet/dry, sandbag fees, multi-unit, native driver app).

---

## 8. Sources

### Goodshuffle Pro
- [Homepage](https://pro.goodshuffle.com/), [Features](https://pro.goodshuffle.com/features/), [Pricing](https://pro.goodshuffle.com/pricing)
- [Integrations](https://pro.goodshuffle.com/integrations/)
- [Lite vs Standard](https://pro.goodshuffle.com/blog/goodshuffle-pro-lite-vs-standard-comparison)
- [Capterra](https://www.capterra.com/p/167364/Goodshuffle-Pro/), [SoftwareAdvice](https://www.softwareadvice.com/retail/goodshuffle-profile/)
- [QBO Integration help](https://help.goodshuffle.com/en/articles/2940250-quickbooks-integration-how-it-works)
- [2026 Roadmap blog](https://demo.goodshuffle.com/blog/event-rental-software-trends-2026-roadmap)
- [TechCrunch Series A](https://techcrunch.com/2024/02/07/goodshuffle-5m-event-rental-management-software/)

### Booqable
- [Features](https://booqable.com/features/), [Pricing](https://booqable.com/pricing/), [Integrations](https://booqable.com/integrations/)
- [What's New / Changelog](https://booqable.com/whats-new/)
- [Capterra](https://www.capterra.com/p/138689/Booqable/reviews/), [G2](https://www.g2.com/products/booqable-rental-software/reviews)
- [Trustpilot](https://www.trustpilot.com/review/www.booqable.com)
- [Roadmap](https://roadmap.booqable.com/)

### InflatableOffice
- [Homepage](https://inflatableoffice.com), [Features](https://inflatableoffice.com/features), [Pricing](https://inflatableoffice.com/pricing)
- [Capterra](https://www.capterra.com/p/135628/InflatableOffice/), [SoftwareAdvice](https://www.softwareadvice.com/rental/inflatableoffice-profile/)
- [IO Workers iOS](https://apps.apple.com/us/app/io-workers/id1612689079), [Android](https://play.google.com/store/apps/details?id=com.inflatableoffice.worker)
