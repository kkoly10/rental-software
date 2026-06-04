# Operator Copilot — Capability Recon & Expansion Roadmap

> **Question this doc answers:** *"What can the Copilot do today, and where else could it help operators run their business more efficiently?"*

This is the source-of-truth for the Copilot's capability roadmap. Update it (don't delete) as phases ship.

---

## Executive summary

The Operator Copilot today is a **context-aware help assistant** that can answer how-to questions and edit five website-content fields. It is engineered well — provider fallback, rate limits, role gating, audit logging, preview-before-apply — but it sits on top of a rich operational platform it **could not see or act on**. Its entire view of the business was a set of *counts* (how many orders/products/payments exist), and its only write power was website copy.

The highest-leverage, lowest-risk expansion is **operational awareness**: give the Copilot a live, read-only view of money owed, today's schedule, and the tasks blocking upcoming events, so it can answer "What needs my attention today?" and "How much am I owed?" with real numbers. **This is now shipped (Phase 1).** Subsequent phases add conversation memory, deep-links, and — behind the same confirm-then-apply guardrails that already protect content edits — the ability to take operational actions (record a payment, send a quote, advance an order, draft a customer reply).

---

## Part 1 — Recon: what the Copilot was before this work

### Architecture

| Layer | File | Role |
|---|---|---|
| UI launcher/panel | `components/copilot/copilot-*.tsx` | Floating assistant on every dashboard page; single-turn chat |
| Chat API | `app/api/copilot/route.ts` | Builds system prompt, calls OpenAI (`gpt-4o-mini`) → Anthropic (`claude-haiku-4-5`) → local keyword fallback |
| Action API | `app/api/copilot/action/route.ts` | Applies website-content edits (the only mutation) |
| Action exec | `lib/copilot/actions.ts` | Writes to `organizations.settings` (5 fields) |
| Context | `lib/copilot/context.ts`, `lib/data/guidance-snapshot.ts` | The Copilot's "world view" |
| System prompt | `lib/copilot/system-prompt.ts` | Role + platform overview + `[ACTION:{…}]` protocol |
| Suggested prompts | `lib/copilot/suggested-prompts.ts` | Per-route quick prompts |
| Access/security | `lib/security/copilot-access.ts` | Auth + org resolution; origin check, rate limits, role gating |

### What it could do

1. **Answer how-to questions** — grounded in 18 Help Center articles + per-page help.
2. **Recommend the next setup step** — reads the onboarding checklist.
3. **Edit 5 website-content fields** (`hero_message`, `service_area_text`, `booking_message`, `custom_faq`, `about_text`) via preview-then-confirm; owner/admin only.

### What it knew

Only the `GuidanceSnapshot` — **counts and booleans** (products/orders/payments/documents counts, profile/branding/pricing flags), plus current route and page-help text.

### Strong foundations worth reusing

- Provider fallback that never surfaces raw provider errors to the user
- Origin validation, dual rate-limiting (user + client), role gating, full audit logging
- Preview-before-apply UX with `current-values` diffing
- i18n-ready (en/es/fr/pt)

---

## Part 2 — The gap

The Copilot sat on top of a platform with a deep operational surface it couldn't reach:

**① Blind to live operations.** `lib/data/analytics.ts` computes revenue, outstanding balance, deposit-collection rate, top products, busiest days; `lib/data/dashboard.ts` computes today's bookings and upcoming deliveries — **none of it reached the Copilot.**

**② Could only edit website text.** The codebase exposes **50+ server actions** the Copilot could orchestrate under the same guardrails:

| Domain | Existing actions |
|---|---|
| Orders | `createOrder`, `updateOrderStatus` |
| Payments | `recordPayment` |
| Quotes | `sendQuote` |
| Documents | `createDocumentsForOrder`, `updateDocumentStatus` |
| Routes/Crew | `createRoute`, `addOrderToRoute`, `updateRouteStatus`, `updateStopStatus` |
| Messaging | `sendReply`, SMS, WhatsApp invites |
| Maintenance | `logMaintenance`, `updateMaintenanceStatus` |
| Pricing/Products/Customers | `savePricingRules`, `createProduct`, `updateProduct`, `updateCustomer` |

**③ Stateless, passive, no deep-links.** Every message started fresh (no memory), it never proactively surfaced a problem, and it could name a page but not link to a specific record.

---

## Part 3 — Opportunity map (ranked by value-to-effort)

### Tier 1 — Operational awareness (read-only) — **SHIPPED (Phase 1)**
Live answers to "How much am I owed?", "What's on today/this week?", "What needs my attention?", "How am I doing this month?", "Any unread messages?". Reuses existing data patterns; zero new mutation risk.

### Tier 2 — Proactive daily briefing
A "What needs my attention today?" roundup (and optional auto-greeting) synthesizing events, unpaid deposits on imminent events, unsigned docs, unread messages, and overdue maintenance. The data for this shipped in Phase 1; the proactive surfacing is the remaining work.

### Tier 3 — Action-taking with confirmation
Extend the proven `[ACTION]` + preview-confirm pattern to high-value, low-blast-radius mutations: record a payment, send a quote / document for signature, advance order status, draft & send a customer reply, log maintenance. Each reuses the role gate, rate limit, audit log, and preview already built.

### Tier 4 — Drafting & communication
Let the model draft customer replies, quote follow-ups, event reminders, and review requests — including WhatsApp/SMS copy (ties to the strategy docs' "WhatsApp is the highest-leverage net-new feature" bet). Operator approves before send.

### Tier 5 — Navigation & memory
Deep-links to specific records (`/dashboard/orders/{id}`), multi-turn conversation memory, and free-form analytics Q&A over the metrics already computed.

---

## Recommended phasing

1. **Phase 1 — read-only operational awareness.** ✅ *Shipped (see below).*
2. **Phase 2 — conversation memory + deep-links.** Small, makes everything feel native.
3. **Phase 3 — action-taking** (payments, quotes, documents, status, message drafts), domain by domain behind the existing confirm-then-apply guardrails.
4. **Phase 4 — proactive alerts + WhatsApp/SMS drafting.** Ties into GTM strategy.

---

## Phase 1 implementation (shipped)

**Goal:** the Copilot can answer real operational questions from this operator's live data, with no new write capability.

**Changes:**

- **`lib/data/operational-snapshot.ts`** (new) — `getOperationalSnapshot()` returns a tight, bounded set of live figures: outstanding balance, revenue collected this month, events today / next 7 days, upcoming orders with a balance owed, unsigned documents for upcoming events, unread messages, and assets in maintenance. Deliberately separate from the heavier `getAnalytics()` since the Copilot calls it on every message; all queries run in parallel and are row-capped.
- **`lib/copilot/context.ts`** — `getOperationalContext()` renders the snapshot into a readable block (currency-aware via the org's formatting), with an explicit "data not available" path for demo mode.
- **`lib/copilot/system-prompt.ts`** — new `LIVE OPERATIONS` section + guidance: use the exact numbers, never invent figures, point to the page to act, and remain read-only for orders/payments/messages.
- **`app/api/copilot/route.ts`** — fetches the operational snapshot in parallel with the guidance snapshot, threads it into the AI system prompt, and — importantly — into the **local keyword fallback** so the no-API-key path can also answer "what needs my attention / how much am I owed / what's on today / how am I doing this month / any unread messages" from real data.
- **`lib/copilot/suggested-prompts.ts`** — surfaces the new operational prompts on the dashboard, payments page, and globally.

**Guardrails preserved:** same auth, origin check, rate limits, org-scoping, and audit logging. No new mutation surface — the Copilot reports numbers and points operators to the page to act.

**Verification:** `tsc --noEmit` clean; full unit suite (123 tests) green.
