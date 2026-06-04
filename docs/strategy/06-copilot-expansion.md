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

### Tier 3 — Action-taking with confirmation — **STARTED (Phase 3: record payment)**
Extend the proven `[ACTION]` + preview-confirm pattern to high-value, low-blast-radius mutations. **Recording an incoming payment is shipped** (see below); send a quote / document for signature, advance order status, draft & send a customer reply, and log maintenance are the queued follow-ons. Each reuses the role gate, rate limit, audit log, and preview already built.

### Tier 4 — Drafting & communication
Let the model draft customer replies, quote follow-ups, event reminders, and review requests — including WhatsApp/SMS copy (ties to the strategy docs' "WhatsApp is the highest-leverage net-new feature" bet). Operator approves before send.

### Tier 5 — Navigation & memory — **SHIPPED (Phase 2)**
Multi-turn conversation memory and deep-links to specific records (`/dashboard/orders/{id}`). Free-form analytics Q&A over the metrics already computed remains a follow-on.

---

## Recommended phasing

1. **Phase 1 — read-only operational awareness.** ✅ *Shipped (see below).*
2. **Phase 2 — conversation memory + deep-links.** ✅ *Shipped (see below).*
3. **Phase 3 — action-taking** (payments, quotes, documents, status, message drafts), domain by domain behind the existing confirm-then-apply guardrails. 🚧 *Record-payment shipped (see below); rest queued.*
4. **Phase 4 — proactive alerts + WhatsApp/SMS drafting.** Ties into GTM strategy.

---

## Phase 1 implementation (shipped)

**Goal:** the Copilot can answer real operational questions from this operator's live data, with no new write capability.

**Changes:**

- **`lib/data/operational-snapshot.ts`** (new) — `getOperationalSnapshot()` returns a tight, bounded set of live figures: outstanding balance, revenue collected this month, events today / next 7 days, upcoming orders with a balance owed, unsigned documents for upcoming events, unread messages, and assets in maintenance. Deliberately separate from the heavier `getAnalytics()` since the Copilot calls it on every message; all queries run in parallel and are row-capped. Definitions are deliberately aligned with the surfaces operators already see: **outstanding balance** sums every open order (statuses other than `cancelled`/`completed`/`refunded`), matching `analytics.ts`, so the Copilot and the Analytics page never disagree; **assets in maintenance** counts `open`/`in_progress` records (not `resolved`).
- **`lib/data/operational-snapshot-summary.ts`** (new) — pure, Supabase-free aggregation helpers (`summarizeOpenOrders`, `summarizeMonthPayments`) so the math is unit-testable in isolation.
- **`lib/copilot/context.ts`** — `getOperationalContext()` renders the snapshot into a readable block (currency-aware via the org's formatting), with an explicit "data not available" path for demo mode.
- **`lib/copilot/system-prompt.ts`** — new `LIVE OPERATIONS` section + guidance: use the exact numbers, never invent figures, point to the page to act, and remain read-only for orders/payments/messages.
- **`app/api/copilot/route.ts`** — fetches the operational snapshot in parallel with the guidance snapshot, threads it into the AI system prompt, and — importantly — into the **local keyword fallback** so the no-API-key path can also answer "what needs my attention / how much am I owed / what's on today / how am I doing this month / any unread messages" from real data.
- **`lib/copilot/suggested-prompts.ts`** — surfaces the new operational prompts on the dashboard, payments page, and globally.

**Guardrails preserved:** same auth, origin check, rate limits, org-scoping, and audit logging. No new mutation surface — the Copilot reports numbers and points operators to the page to act.

**Verification:** `tsc --noEmit` clean; full unit suite green, including new coverage in `tests/operational-snapshot-summary.test.ts` for the balance/event/revenue aggregation (outstanding balance, event windows, balance-due-soon, refund netting, empty-business and never-negative edge cases).

## Phase 2 implementation (shipped)

**Goal:** make the operational answers feel native — the Copilot remembers the conversation and links straight to the specific records it mentions.

**Changes:**

- **Conversation memory.** `lib/validation/copilot.ts` now accepts an optional `history` array (bounded to `COPILOT_HISTORY_LIMIT = 10` turns, each ≤4000 chars). The panel (`components/copilot/copilot-panel.tsx`) sends the recent turns via a `messagesRef` mirror (so `sendMessage` doesn't churn its dependency list). The route threads history into both providers through `lib/copilot/conversation.ts` → `buildConversationMessages()`, which normalizes any malformed history into a valid sequence (opens on a user turn, strictly alternates, no dangling trailing user turn) — important because Anthropic rejects otherwise. Follow-ups like "which ones?" / "what about last month?" now resolve against prior turns.
- **Deep-links to specific records.** `getOperationalSnapshot()` now also returns `attentionOrders`: up to 5 specific upcoming orders that still owe money, soonest event first, each with a `/dashboard/orders/{id}` link and a `#order — customer` label. The context layer emits these as ready-to-use markdown links, and the local fallback lists them under the "owed" and "attention" answers. `renderSafeRichText` already renders `/`-relative markdown links as safe same-tab anchors, so they're clickable end-to-end. The system prompt instructs the model to use only the provided links/labels and never invent records.

**Guardrails preserved:** still read-only; history is size- and count-bounded server-side; no new mutation surface.

**Verification:** `tsc --noEmit` clean; full unit suite green, including new `tests/copilot-conversation.test.ts` (history normalization: well-formed, empty, leading-assistant, repeated-role, dangling-user, and an always-valid-shape invariant).

## Phase 3 implementation (record payment — shipped)

**Goal:** the first **write** action — let the Copilot record an incoming payment, behind the same confirm-then-apply preview that already protects content edits, reusing the fully-guarded `recordPayment` server action so no financial logic is re-implemented.

**Design — defense in depth:**

- **Reuses `lib/payments/actions.ts` `recordPayment`** verbatim via `executeCopilotAction` → `executePaymentAction()`. That action already re-validates the payload (`recordPaymentSchema`), enforces org-scoping, role (owner/admin/dispatcher), rate limits, terminal-state guards, records atomically through the `record_manual_payment` RPC (SELECT FOR UPDATE), writes an audit log, auto-confirms on deposit fulfilment, and fires customer email/SMS.
- **Two extra gates on top:** the `/api/copilot/action` route restricts *all* Copilot actions to **owner/admin** (stricter than `recordPayment`'s own check), with origin validation, its own rate limit, and an audit-log entry carrying `{orderId, amount, paymentType, paymentMethod}`.
- **Confirm-before-apply:** a dedicated payment preview (`PaymentActionPreview`) shows the amount, method, type, optional note, and a **"View order" deep-link to verify the order** before the operator clicks Record.
- **Refunds are deliberately out of scope** — recording money *out* is the most error-sensitive operation, so it stays a manual Payments-page flow. The parser, route schema, type, and prompt all reject `refund`.
- **Validated three times:** client parser (`lib/copilot/parse-action.ts`, extracted + unit-tested), the route's `paymentActionSchema`, and `recordPayment` itself.

**Changes:** action types/union (`lib/copilot/actions.ts`); discriminated route schema + branched audit/revalidate (`app/api/copilot/action/route.ts`); extracted, hardened `parseActionFromResponse` (`lib/copilot/parse-action.ts`); payment preview + i18n in all four locales (`copilot-action-preview.tsx`, `messages/*`); `record_payment` protocol in the system prompt; order IDs exposed in the operational context; a "Record a payment" suggested prompt.

**Verification:** `tsc --noEmit` clean; full unit suite green, including new `tests/copilot-parse-action.test.ts` (content + payment parsing, amount coercion, empty-note dropping, and rejection of bad method / non-positive amount / missing orderId / refund / malformed JSON).
