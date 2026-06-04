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

### Tier 2 — Proactive daily briefing — **SHIPPED (Phase 4)**
When the Copilot panel opens it now seeds a deterministic "what needs my attention" briefing as the first assistant message (`lib/copilot/briefing.ts` + `GET /api/copilot/briefing`): events today / next 7 days, balances due soon, unsigned docs, unread messages, assets in maintenance — with deep-links to act. No AI cost; returns nothing (normal empty state) when there's nothing to report.

### Tier 3 — Action-taking with confirmation — **IN PROGRESS (Phase 3)**
Extend the proven `[ACTION]` + preview-confirm pattern to high-value, low-blast-radius mutations. **Shipped:** record an incoming payment; **advance order status** (`update_order_status`, non-destructive forward transitions only — `cancelled`/`refunded` stay manual; reuses `updateOrderStatus`'s state machine + TOCTOU); **generate documents** (`generate_documents` → `createDocumentsForOrder`: creates the rental agreement + safety waiver and emails the customer to sign; duplicate-guarded); **draft & send a customer reply** (`send_reply` → `sendReply`: drafts a reply grounded in an unread thread and **sends a real email** — surfaces unread threads in context; the preview shows the full draft + recipient + "this sends an email" notice; audit logs recipient + body length, not the full body). **send a quote** (`send_quote` → `sendQuote`: emails the quote and moves an inquiry/quote_sent order to Quote Sent; status-guarded). *Note:* the standalone `mark_document_sent` flip was intentionally skipped. **All five action-taking capabilities are now shipped and individually live-verified.** Each reuses the role gate, one-time acknowledgment, rate limit, audit log, and preview already built.

### Tier 4 — Drafting & communication
Let the model draft customer replies, quote follow-ups, event reminders, and review requests — including WhatsApp/SMS copy (ties to the strategy docs' "WhatsApp is the highest-leverage net-new feature" bet). Operator approves before send.

### Tier 5 — Navigation & memory — **SHIPPED (Phase 2)**
Multi-turn conversation memory and deep-links to specific records (`/dashboard/orders/{id}`). Free-form analytics Q&A over the metrics already computed remains a follow-on.

---

## Recommended phasing

1. **Phase 1 — read-only operational awareness.** ✅ *Shipped (see below).*
2. **Phase 2 — conversation memory + deep-links.** ✅ *Shipped (see below).*
3. **Phase 3 — action-taking** (record payment, advance status, generate documents, draft & send reply, send quote), each behind the confirm-then-apply guardrails. ✅ *All five shipped + live-verified.*
4. **Phase 4 — proactive briefing + WhatsApp/SMS drafting.** ✅ *Both shipped.* (Proactive daily briefing; SMS/WhatsApp message **drafting** — the Copilot writes channel-appropriate copy with a one-click Copy button. Actually *sending* SMS/WhatsApp from the Copilot is deliberately out of scope for now — there's no high-level guarded send action to reuse, and free-text SMS needs opt-in/compliance review; that would be a separate guarded `send_sms`/`send_whatsapp` action.)

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

**Attribution / legal coverage.** Because the Copilot records real money, every Copilot-initiated payment is unambiguously attributable:
- The payment row's reference note is deterministically stamped **"Added via Operator Copilot on YYYY-MM-DD HH:MM UTC"** server-side (`lib/copilot/payment-note.ts`, unit-tested, capped to the 120-char column; UTC for timezone-unambiguity) — visible in the Payments view and the accounting CSV export. The note is internal-only (never shown to customers).
- The recording **operator's identity** (authenticated user) and **timestamp** (`paid_at` / `created_at`) also live on the payment row.
- The authoritative `payments.record_manual` audit-log entry carries `recorded_via: "copilot"` (in addition to actor, timestamp, amount, order), and the separate `copilot.action` audit entry independently records the same event — two correlated trails.
- The confirm-before-apply preview shows an explicit **authorization notice**: confirming records the payment via Copilot under the operator's account, timestamped and logged.

**Why this holds up (informal, not legal advice).** This design matches the controls regulators and e-records law emphasize for AI-assisted financial actions:
- **Human-in-the-loop authorization** — the operator must explicitly confirm before anything is written. Industry guidance for agentic AI singles out *financial disbursements* as the category that should require human approval, and stresses that accountability rests with the human who authorizes — delegating to AI doesn't dilute it. Our confirm-before-apply preview is exactly this control.
- **Attributable + timestamped + retainable records** (the E-SIGN / UETA integrity principles): who (authenticated operator), when (UTC stamp + `paid_at`/`created_at`), what (amount/method/order), and via-what-channel are all captured and retained.
- **Tamper-resistance**: `app_event_logs` has RLS enabled and `revoke all ... from anon, authenticated`, so operators/staff cannot read, edit, or delete the audit log through the app (server-role writes only); and no code path edits a payment's `reference_note` after creation, so the stamp is write-once.
- **Hardening (implemented):**
  1. **IP + user-agent** are captured on every executed Copilot action and stored in the audit-log metadata (`app/api/copilot/action/route.ts`), strengthening non-repudiation per e-sign audit-trail best practices.
  2. **Hash-chained, WORM `app_event_logs`** (`supabase/migrations/20260605_020000_*`, `_050000_*`): a `BEFORE INSERT` trigger assigns a sequence and a SHA-256 `entry_hash` covering the previous row's hash (tamper-EVIDENT — any edit/insert/delete breaks the chain), and `BEFORE UPDATE`/`DELETE`/`TRUNCATE` triggers block mutation entirely (append-only, even for the service role; the TRUNCATE guard is statement-level since row triggers don't fire on TRUNCATE). `verify_app_event_log_chain()` walks the chain and returns the first break. `app_event_logs` was verified INSERT-only in the codebase, so WORM breaks nothing. (DROP/ALTER-DISABLE-TRIGGER still require DB-admin and are out of the app threat model; the hash chain makes any such tampering detectable.)
  3. **One-time AI-assistance acknowledgment** (`supabase/migrations/20260605_030000_*`, `lib/copilot/acknowledgment.ts`, `app/api/copilot/acknowledge/route.ts`, `components/copilot/copilot-ack-prompt.tsx`): before an operator's first Copilot action they must accept the terms; acceptance is stored per org+user+version with timestamp + IP/user-agent as consent evidence. Gated both client-side (prompt shown in place of the action preview) and server-side (the action route rejects un-acknowledged actions), and **fails open** if the table isn't provisioned yet so the feature never hard-breaks before the migration runs.
- **Deployment note:** the migrations were **applied to the Korent Supabase project (`gotyqamdmjxadntkvhkk`) and verified** — chain trigger populates a 64-char SHA-256 hash on insert, `verify_app_event_log_chain()` reports 0 breaks, WORM rejects UPDATE/DELETE, and the acknowledgment table has RLS + own-row policies. A follow-up hardening migration (`20260605_040000`) revokes RPC EXECUTE on the chain functions from anon/authenticated and pins their `search_path`, per the security advisor. (CI/deploy still doesn't run migrations; these were applied via the Supabase MCP.)
- **Still not done (optional):** a one-time *Terms-of-Service* surface beyond the in-Copilot acknowledgment. **An attorney should review for the operator's jurisdiction before relying on any of this as legal protection.**

**Changes:** action types/union (`lib/copilot/actions.ts`); discriminated route schema + branched audit/revalidate (`app/api/copilot/action/route.ts`); extracted, hardened `parseActionFromResponse` (`lib/copilot/parse-action.ts`); payment preview + i18n in all four locales (`copilot-action-preview.tsx`, `messages/*`); `record_payment` protocol in the system prompt; order IDs exposed in the operational context; a "Record a payment" suggested prompt.

**Verification:** `tsc --noEmit` clean; full unit suite green, including new `tests/copilot-parse-action.test.ts` (content + payment parsing, amount coercion, empty-note dropping, and rejection of bad method / non-positive amount / missing orderId / refund / malformed JSON).
