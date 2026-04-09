# Launch Readiness Analysis (Business + Product)

Date: 2026-04-09

## Executive summary

You are correct: there is a major mismatch between what the **marketing site** promises and what the **demo/storefront experience** shows. The current architecture intentionally serves two different audiences (operator SaaS on root domain, customer storefront on tenant domains), but the messaging, pricing narrative, and feature promises are not aligned enough for launch confidence.

The good news: the product foundation is strong. The largest launch risks are not core CRUD flows; they are **positioning consistency, production configuration discipline, and go-to-market operations**.

---

## 1) Demo site vs marketing site discrepancy audit

### A. Audience split is technically correct but commercially confusing

- Root domain (`/`) shows operator-focused SaaS landing content (`SaasLanding`) when no tenant host is resolved.
- Tenant domains show customer storefront content with booking/catalog flow.

This is a sound multitenant pattern, but if a prospect clicks “See a Live Demo,” they land on a **customer storefront** that does not clearly communicate the operator dashboard depth unless they already understand the model.

### B. Pricing story is inconsistent across surfaces

- SaaS landing says: “Start free with up to 5 products and 10 orders/month.”
- Stripe plan config + pricing pages present paid tiers starter/pro/growth at $49/$99/$199 and trial framing.

This creates immediate trust friction in sales conversations.

### C. Feature claims are ahead of implementation in at least one key area

- README still marks some capabilities as scaffolded/deferred (for example Stripe automation in one section), while production code includes webhook handling for subscription + payment synchronization.

This inconsistency makes it hard for sales/support to answer “what works today?” without checking code.

### D. Demo-mode and production readiness messaging conflict

- The app has a production guard to block running in demo mode without required env vars (good).
- But many parts of the product and documentation still normalize “it runs in demo mode with mock data,” which is useful in dev, risky for commercial confidence unless tightly communicated.

### E. Brand/CTA pathing can leak confusion

- Demo banner points to a fixed `https://korent.app/signup` CTA.
- SaaS landing demo button points to `demo.<APP_DOMAIN>`.

These are close, but they should be standardized and UTM-tracked so attribution and conversion funnels are clear.

---

## 2) What is missing for a confident business launch

## P0 (must-fix before broad paid acquisition)

1. **Single source of truth for plans + limits + copy**
   - Unify plan copy across `SaasLanding`, `/pricing`, Stripe config, and onboarding paywall prompts.
   - Remove contradictory “free plan” language unless the backend actually enforces that tier.

2. **Demo-to-paid narrative redesign**
   - Add an operator-focused “What you saw vs what you get in dashboard” bridge section on demo flows.
   - Ensure every demo CTA maps to one measurable conversion event (signup, book demo call, start trial).

3. **Launch definitions and readiness gates**
   - Define explicit go/no-go checklist: env vars present, webhooks verified, cron secrets configured, domain verification tested, invoice route tested, email/SMS paths validated.
   - No marketing spend until checklist is green in staging + production.

4. **Commercial analytics instrumentation**
   - Add event tracking for: landing CTA clicks, demo visits, signup starts, signup completes, onboarding completion, first product added, first order created, first payment captured.
   - Build one launch dashboard (funnel + activation + trial-to-paid).

5. **Positioning consistency pack for sales/support**
   - One “capability matrix” shared across website copy, sales decks, support scripts, and in-app help.
   - Prevent feature mismatch between what is promised and what operators actually receive.

## P1 (critical in first 30 days post-launch)

1. **Operational trust layer**
   - Publish status/support SLAs, response times, and incident process.
   - Add visible trust markers: security posture, data retention summary, backup/recovery statement.

2. **Lifecycle communications completeness**
   - Ensure email/SMS templates are production-ready for all key journey points (order confirmation, reminders, payment events, failed payment recovery).
   - Validate deliverability domain/auth setup before paid traffic.

3. **Customer evidence**
   - Replace generic testimonial placeholders with named case studies (with permission).
   - Add quantified outcomes tied to operator jobs-to-be-done.

4. **Competitive objection handling**
   - Prepare migration and ROI narrative against incumbents (pricing transparency, setup time, admin time saved).

## P2 (scale readiness)

1. **Churn prevention systems**
   - In-app nudges and triggered outreach for low-activation trials.
2. **Expansion economics**
   - Packaging tests (annual discount experiments, add-ons).
3. **Partner/channel motion**
   - Referral and affiliate model for local operator communities.

---

## 3) Specific technical/commercial risks to track weekly

1. **Messaging drift risk**: Different teams edit marketing/demo pages without a content contract.
2. **Configuration risk**: Env-dependent services may be partially configured across environments.
3. **Attribution blind spots**: Demo traffic may not be tied to downstream activation.
4. **Expectation risk**: Prospects expect “all automated” while some workflows remain mixed/manual.
5. **Support load spike risk**: If onboarding guidance and docs are not tightly aligned with product state.

---

## 4) 30/60/90 launch plan

### Next 14 days (stabilize narrative)

- Freeze pricing/feature messaging and align all public surfaces.
- Create a “Demo experience map” from ad click to paid conversion.
- Publish internal launch checklist with owners and pass/fail criteria.

### Day 15–45 (controlled launch)

- Start with limited acquisition channels.
- Review funnel + onboarding drop-offs twice weekly.
- Tighten onboarding prompts around first value moment (first published product + first accepted booking).

### Day 46–90 (scale)

- Expand channels once trial-to-paid and retention thresholds hold.
- Ship proof-based marketing (case studies, before/after operator metrics).
- Iterate plans/packaging only after telemetry confirms usage patterns.

---

## 5) Immediate “top 10” actions (prioritized)

1. Align pricing copy in SaaS landing with actual Stripe-backed tiers.
2. Add a dedicated “Operator demo” page/video walkthrough linked from all demo CTAs.
3. Create canonical feature matrix and lock wording for website + sales + help center.
4. Implement funnel analytics events end-to-end.
5. Formalize launch checklist and require green checks in staging/production.
6. Replace placeholder/generic testimonials with real customer proof.
7. Standardize CTA URLs and apply campaign parameters.
8. Audit all lifecycle notifications for production deliverability.
9. Define a support playbook for first 50 paid accounts.
10. Run a soft launch cohort before full rollout.

---

## 6) Bottom line

The product is close enough to launch from a **feature foundation** perspective, but not yet from a **commercial consistency** perspective. Your stated concern (demo vs marketing discrepancy) is the right highest-priority issue.

If you fix messaging/packaging consistency, instrument the funnel, and enforce launch gates, you can launch with significantly lower trust risk and better conversion efficiency.
