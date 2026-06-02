# Korent Strategy & Research Index

This directory documents the strategic research conducted in June 2026 to answer:

> **"Where should Korent launch, who should we target, and what should we build to win?"**

These docs are the source-of-truth for **why** product, pricing, and GTM decisions were made. They should be updated (not deleted) when new evidence changes the picture.

---

## Documents

| # | File | Purpose |
|---|---|---|
| 0 | `README.md` (this file) | Index + key decisions log |
| 1 | [`01-market-analysis.md`](./01-market-analysis.md) | Mexico market sizing, US tier-2 validation, alternative markets comparison |
| 2 | [`02-competitive-analysis.md`](./02-competitive-analysis.md) | Feature audits of Goodshuffle Pro, Booqable, InflatableOffice + Korent codebase recon + master feature matrix |
| 3 | [`03-payments-and-pricing.md`](./03-payments-and-pricing.md) | SaaS pricing benchmarks, Stripe Mexico capabilities, Conekta integration analysis, Mexican entity requirements, IVA obligations |
| 4 | [`04-gtm-and-positioning.md`](./04-gtm-and-positioning.md) | GTM channels (US + Mexico), 30-article SEO content calendar, positioning statement vs Goodshuffle Pro |

The actionable execution plan derived from this research lives at the repo root: [`COMPETITIVE_POSITIONING_MASTER_PLAN.md`](../../COMPETITIVE_POSITIONING_MASTER_PLAN.md).

---

## Executive summary (3 sentences)

Korent already has the features Goodshuffle Pro customers complain about missing — SMS, customer portal, white-label storefronts, AI Copilot, bilingual UI — at half the realistic price. The fastest path to revenue is targeting Goodshuffle Pro's solo-operator long tail in US tier-2/3 cities (Tampa, Phoenix, Nashville, Austin) with a head-on comparison page, then expanding into US Hispanic markets and Mexico as a second wave. Mexico is real but requires a 2-4 month Mexican entity setup (SA de CV + RFC + CLABE) and Spanish-speaking sales support, so it is a 6-12 month play that runs in parallel — not the first beachhead.

---

## Key strategic decisions log

These are the load-bearing choices. When changing any of them, update this log with the new decision, the date, and the new evidence.

| Decision | Date | Rationale | Source doc |
|---|---|---|---|
| **Primary target: Goodshuffle Pro** (not Booqable, not InflatableOffice) | Jun 2026 | Largest realistic price gap ($257 → $99), most exploitable feature gaps (SMS, portal, mobile, API, AI, white-label), customers explicitly complain about price/missing features | [02](./02-competitive-analysis.md) |
| **Primary vertical: party/event rental** (not car rental, not equipment rental) | Jun 2026 | Car rental in Mexico has entrenched global SaaS (HQ Rentals) + insurance/regulatory complexity; equipment rental has long sales cycles + Spanish-relationship-heavy + ERP incumbents (MCS, Oliversoft) | [01](./01-market-analysis.md) |
| **Primary geography: US tier-2/3 cities** (Tampa, Phoenix, Nashville, Austin) | Jun 2026 | English-only sales motion, Stripe USD billing zero-friction, real $99/mo wedge below Goodshuffle Standard ($139 + $79 website + $39 QBO = $257) | [01](./01-market-analysis.md), [04](./04-gtm-and-positioning.md) |
| **Mexico as secondary, not primary** | Jun 2026 | Mexican entity setup is 2-4 months on critical path; ~17,000 SMB operators is meaningful but Eventrix (2024) and EventControl (claims 500+ event halls) are real local competition with CFDI; no Spanish on the founding team | [01](./01-market-analysis.md), [03](./03-payments-and-pricing.md) |
| **Mexico payment processor: Stripe Mexico** (not Conekta) | Jun 2026 | Codebase is already Stripe-shaped (saves ~14 of 18 dev-days vs Conekta); both processors require Mexican entity anyway, so no advantage from switching | [03](./03-payments-and-pricing.md) |
| **WhatsApp Business API is the single highest-leverage net-new feature** | Jun 2026 | None of Goodshuffle, Booqable, or InflatableOffice ship native WhatsApp; opens US Hispanic + Mexico instantly; reuses existing Twilio SMS abstraction (<2 weeks build) | [02](./02-competitive-analysis.md) |
| **Pricing: Starter $49 / Pro $99 / Growth $199** USD | Jun 2026 | $99 Pro undercuts Goodshuffle's realistic $257/mo all-in while including white-label site, SMS, portal that competitors gate or omit | [02](./02-competitive-analysis.md), [03](./03-payments-and-pricing.md) |

---

## Confidence levels

Be honest about what we know vs guess.

| Claim | Confidence | Notes |
|---|---|---|
| Korent's feature set already matches Goodshuffle Pro at the table-stakes layer | **High** | Verified via codebase recon + Goodshuffle audit |
| Goodshuffle Pro's realistic monthly cost is $178-258 with required add-ons | **High** | Confirmed from Capterra + their own pricing page |
| US universe is ~25-35K party rental operators, 150-400 per target metro | **Medium** | IBISWorld confirmed 9,675 NAICS 532289; informal LLCs estimated |
| Mexican SaaS pricing should be 30-50% of US pricing | **Medium** | Paddle/Monetizely benchmarks are directional, not Mexico-specific |
| Stripe Mexico and Conekta both require Mexican RFC + CLABE | **Medium-High** | Confirmed via Stripe support docs; should be reconfirmed in writing with each vendor's sales team before committing |
| WhatsApp Business API integration is <2 weeks of dev work | **Medium** | Based on existing Twilio abstraction; needs spike to confirm |
| 12 paying customers at $39 avg MRR ($468 MRR) by Day 90 is achievable | **Low-Medium** | Bootstrapper benchmarks vary widely; sensitive to founder's outbound capacity |

---

## How to use these docs

- **Onboarding a new contributor or refreshing memory months later**: Start with this README, then read the doc covering the area you're working on
- **Updating a decision**: Edit the relevant research doc with the new evidence, then update the decisions log above with the date and rationale
- **Tracking work in progress**: All execution-level checkboxes live in [`COMPETITIVE_POSITIONING_MASTER_PLAN.md`](../../COMPETITIVE_POSITIONING_MASTER_PLAN.md), not here

---

## Research methodology

All four research docs were produced by parallel fan-out agents that:
1. Decomposed each question into 3-5 search angles
2. Ran WebSearch + WebFetch across 50+ primary sources
3. Adversarially verified key claims (e.g., "do competitors really lack Mexico support?" was checked vendor-by-vendor)
4. Synthesized findings with explicit confidence flags on thin data

Where data was thin or extrapolated, it is flagged inline with "uncertainty flag" or "estimate."
