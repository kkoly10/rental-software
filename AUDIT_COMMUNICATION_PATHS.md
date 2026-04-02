# Communication Paths Audit

**Date:** 2026-04-02
**Scope:** All message, email, notification, and alert flows between Customer, Operator, and Platform (Korent)

---

## Part 1: Existing Communication Audit

### Email (Resend)

#### Templates Defined (`lib/email/templates.ts`)

| # | Template | Subject Line | Recipient | Status |
|---|----------|-------------|-----------|--------|
| 1 | `orderConfirmationEmail` | "Booking #{orderNumber} received — {businessName}" | Customer | **FULLY WORKING** |
| 2 | `newOrderAlertEmail` | "New order #{orderNumber} from website/dashboard" | Operator | **FULLY WORKING** |
| 3 | `paymentReceivedEmail` | "Payment received for order #{orderNumber} — {businessName}" | Customer | **FULLY WORKING** |
| 4 | `refundProcessedEmail` | "Refund processed for order #{orderNumber} — {businessName}" | Customer | **FULLY WORKING** |
| 5 | `orderStatusUpdateEmail` | "Order #{orderNumber} — {status} — {businessName}" | Customer | **FULLY WORKING** |
| 6 | `documentsReadyEmail` | "Documents ready for order #{orderNumber} — {businessName}" | Customer | **FULLY WORKING** |
| 7 | Team invite (inline HTML) | "You've been invited to join {businessName}" | Team member | **FULLY WORKING** |
| 8 | Contact form (inline HTML) | "Contact form: {subject}" | support@korent.app | **FULLY WORKING** |

#### Trigger Functions (`lib/email/triggers.ts`)

| # | Function | Event | Called From | Actually Called? |
|---|----------|-------|-------------|-----------------|
| 1 | `triggerOrderConfirmationEmail` | Website checkout order created | `lib/checkout/actions.ts:466` | **YES** — sends to customer AND operator |
| 2 | `triggerDashboardOrderEmail` | Dashboard order created | `lib/orders/actions.ts:360` | **YES** — sends to operator only |
| 3 | `triggerPaymentReceivedEmail` | Payment recorded or refund issued | `lib/payments/actions.ts:152` | **YES** — sends to customer |
| 4 | `triggerOrderStatusEmail` | Order status changed | `lib/orders/actions.ts:441` | **YES** — sends to customer (6 status types: confirmed, scheduled, out_for_delivery, delivered, completed, cancelled) |
| 5 | `triggerDocumentsReadyEmail` | Documents created for order | `lib/documents/actions.ts:184` | **YES** — sends to customer |

All triggers use non-blocking dynamic `import().then()` pattern — email failure never blocks the primary action.

**Sender:** `Korent <noreply@korent.app>` (or custom via `EMAIL_FROM_ADDRESS` env var)
**Infrastructure:** Resend SDK v6.9.4 (`lib/email/client.ts`, `lib/email/send.ts`)

#### Email Gap Analysis

| Question | Answer |
|----------|--------|
| Does operator receive email on new order? | **YES** — `newOrderAlertEmail` sent via `triggerOrderConfirmationEmail` |
| Does customer receive order confirmation? | **YES** — `orderConfirmationEmail` sent immediately |
| Does customer receive event reminder? | **NO** — no scheduled/cron email system exists |
| Does customer receive delivery day reminder? | **NO** — only status-change emails when operator manually updates |

---

### SMS (Twilio)

| # | File | Purpose | Status |
|---|------|---------|--------|
| 1 | `lib/sms/provider.ts` | Low-level `sendSms()` via Twilio API | **DEFINED BUT NOT CALLED** |
| 2 | `lib/sms/send-notification.ts` | `sendSmsNotification()` wrapper with template + settings check | **DEFINED BUT NOT CALLED** |
| 3 | `lib/sms/templates.ts` | 7 template functions (orderConfirmation, depositReminder, deliveryScheduled, deliveryEnRoute, deliveryCompleted, weatherAlert, paymentReceived) | **DEFINED BUT NOT CALLED** |
| 4 | `lib/sms/actions.ts` | `updateSmsSettings()` server action | **PARTIALLY WORKING** — saves settings to DB, but settings are never read by any send path |
| 5 | `lib/data/sms-settings.ts` | `getSmsSettings()` data layer | **PARTIALLY WORKING** — reads settings, used by settings form only |
| 6 | `components/settings/sms-settings-form.tsx` | Toggle SMS notifications on/off | **PARTIALLY WORKING** — UI works, toggles save, but nothing sends |
| 7 | `components/settings/sms-log.tsx` | SMS log viewer | **PARTIALLY WORKING** — shows demo data only, no real log table |

**Verdict: SMS is a complete ghost feature.** The entire Twilio integration is built — provider, templates (7 types), settings UI, toggle per notification type — but `sendSmsNotification()` is never imported or called anywhere in the checkout, payment, order, or delivery flows. Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

---

### Portal / Customer Self-Service (`/order-status`)

| # | Feature | Component | Status |
|---|---------|-----------|--------|
| 1 | Order lookup by number + email | `components/portal/order-lookup-form.tsx` | **FULLY WORKING** |
| 2 | Order status timeline | `components/portal/order-timeline.tsx` | **FULLY WORKING** — visual progress (Inquiry → Confirmed → Scheduled → Delivering → Delivered → Completed) |
| 3 | Pricing breakdown | Inline in `order-lookup-form.tsx` | **FULLY WORKING** — subtotal, delivery fee, total, deposit, balance |
| 4 | Invoice PDF download | `components/portal/invoice-download.tsx` | **FULLY WORKING** — client-side jsPDF generation |
| 5 | Document signing | `components/portal/document-sign.tsx` → `app/api/portal/sign-document/route.ts` | **FULLY WORKING** — digital signature with name + checkbox |
| 6 | Send message to operator | `components/portal/customer-message-form.tsx` → `app/api/portal/send-message/route.ts` | **PARTIALLY WORKING** — sends email to operator, but no message history or reply tracking |

**Portal messaging detail:**

- Customer selects subject: "Question about my order", "Request to reschedule", "Request to cancel", "Other"
- Message is emailed directly to operator's `support_email` via Resend API
- `Reply-To` header is set to customer's email so operator can respond via email client
- **No database storage** — messages are fire-and-forget emails
- **No conversation history** — customer can't see sent messages or operator replies
- Rate limited: 5 messages per 600s per IP, 3 per 600s per email

---

### In-App Notifications (Dashboard)

| # | Feature | Location | Status |
|---|---------|----------|--------|
| 1 | Notification bell icon | `components/dashboard/notification-center.tsx` displayed in `components/layout/dashboard-shell.tsx:84` | **PARTIALLY WORKING** |
| 2 | Notification dropdown panel | Same component | **PARTIALLY WORKING** |
| 3 | Unread badge count | Client-side computed | **PARTIALLY WORKING** |
| 4 | Mark all as read | Client-side state only | **PARTIALLY WORKING** — resets on page refresh |

**How notifications are generated (`lib/data/notifications.ts`):**

- Queries `orders`, `payments`, and `customers` tables for records from the past 7 days
- Dynamically builds notifications from database records
- Types: `new_order`, `payment_received`, `order_confirmed`, `delivery_scheduled`, `new_customer`
- Falls back to demo notifications when no Supabase env

**Critical limitations:**

- **No dedicated `notifications` table** — computed on-the-fly from other tables
- **Read/unread state is client-side only** — `useState` in the React component. Refreshing the page resets all to unread
- **No real-time updates** — no WebSocket, no polling, no Supabase Realtime subscription
- **No push notifications** — service worker is registered but no push implementation
- `low_inventory` type is defined but never generated (no inventory threshold logic)

---

### Automated Triggers Matrix

| Event | Email to Customer | Email to Operator | SMS | In-App Notification |
|-------|:-:|:-:|:-:|:-:|
| New order (website) | **YES** | **YES** | MISSING | **YES** (computed) |
| New order (dashboard) | NO | **YES** | MISSING | **YES** (computed) |
| Payment received | **YES** | NO | MISSING | **YES** (computed) |
| Refund processed | **YES** | NO | MISSING | NO |
| Order confirmed | **YES** | NO | MISSING | **YES** (computed) |
| Order scheduled | **YES** | NO | MISSING | **YES** (computed) |
| Out for delivery | **YES** | NO | MISSING | NO |
| Delivered | **YES** | NO | MISSING | NO |
| Completed | **YES** | NO | MISSING | NO |
| Cancelled | **YES** | NO | MISSING | NO |
| Documents ready | **YES** | NO | MISSING | NO |
| Document signed | NO | NO | MISSING | NO |
| Delivery scheduled | NO | NO | MISSING | **YES** (computed) |
| Weather alert | NO | NO | MISSING | NO |
| Upcoming event (1 day before) | **MISSING** | **MISSING** | MISSING | MISSING |
| Event morning reminder | **MISSING** | **MISSING** | MISSING | MISSING |
| New customer created | NO | NO | MISSING | **YES** (computed) |

---

## Part 2: Communication Gap Analysis

### Customer → Operator

| # | Communication Path | Status | Details |
|---|-------------------|--------|---------|
| 1 | Pre-sale inquiry | **PARTIALLY WORKING** | `/contact` form exists but goes to `support@korent.app` (platform), NOT to operator. The operator's email is shown on the contact page but the form doesn't send to them. `lib/contact/actions.ts` hardcodes `support@korent.app`. |
| 2 | Message about existing order | **PARTIALLY WORKING** | Portal message form sends email to operator's `support_email`. But no history, no tracking, no way to see if operator read it. |
| 3 | Request booking change | **PARTIALLY WORKING** | Customer can select "Request to reschedule" subject in portal message form. But it's just an email — no structured reschedule workflow. |
| 4 | Cancel/request cancellation | **PARTIALLY WORKING** | Customer can select "Request to cancel" in portal. Again just an email — no self-service cancellation. |
| 5 | Report issue during/after event | **PARTIALLY WORKING** | Same portal message form or contact page. No dedicated issue reporting flow. |

### Operator → Customer

| # | Communication Path | Status | Details |
|---|-------------------|--------|---------|
| 1 | Order confirmation | **FULLY WORKING** | `triggerOrderConfirmationEmail` — auto-sent on checkout (`lib/checkout/actions.ts:466`) |
| 2 | Payment receipt | **FULLY WORKING** | `triggerPaymentReceivedEmail` — auto-sent when payment recorded (`lib/payments/actions.ts:152`) |
| 3 | Delivery details (time window, instructions) | **PARTIALLY WORKING** | `orderStatusUpdateEmail` with "scheduled" status includes generic text "Your delivery has been scheduled" but does NOT include the actual time window or setup instructions. The email template (`lib/email/templates.ts:270`) is generic — no dynamic delivery details. |
| 4 | Event-day reminders | **MISSING** | No scheduled email system. No cron jobs. No morning-of or day-before automated messages. |
| 5 | Follow-up after event | **MISSING** | No post-event email. The "completed" status email says "We hope your event was a success" but there's no review request, feedback form, or rebooking CTA. |
| 6 | Manual message about order | **MISSING** | No operator → customer messaging UI in dashboard. Operator must use their own email client. |
| 7 | Promotional/marketing messages | **MISSING** | No marketing email system, no customer list export for external tools, no promotional campaigns. |

### Platform → Operator

| # | Communication Path | Status | Details |
|---|-------------------|--------|---------|
| 1 | Onboarding guidance | **MISSING** | No welcome email. No setup progress emails. No tips series. |
| 2 | Billing/subscription notifications | **PARTIALLY WORKING** | Stripe webhook handles `invoice.payment_failed` and updates DB status to `past_due`. But no email is sent to operator about the failure. (`app/api/stripe/webhooks/route.ts:92-108`) |
| 3 | Feature announcements | **MISSING** | No mechanism. |
| 4 | System alerts | **MISSING** | Error logging exists (`lib/observability/`) but no operator-facing alerts. |
| 5 | Re-engagement emails | **MISSING** | No last-login tracking or automated outreach. |

### Operator → Platform

| # | Communication Path | Status | Details |
|---|-------------------|--------|---------|
| 1 | Support requests | **PARTIALLY WORKING** | Dashboard help page exists (`app/dashboard/help/`) with articles, but no ticket submission form. Contact form on public site goes to `support@korent.app`. |
| 2 | Feature requests | **MISSING** | No mechanism. |
| 3 | Billing questions | **PARTIALLY WORKING** | Stripe Billing Portal exists (`lib/stripe/actions.ts:createBillingPortalSession`) for self-service subscription management. But no way to contact Korent about billing issues. |

---

## Part 3: Operator Dashboard — Message Management

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Is there an inbox/message center? | **NO** | **MISSING** |
| 2 | Can operators see all customer communications? | **NO** — messages go to email only, no dashboard view | **MISSING** |
| 3 | Can operators reply from dashboard? | **NO** — must use external email client | **MISSING** |
| 4 | Conversation threading? | **NO** — no database storage of messages at all | **MISSING** |
| 5 | Notification badges for unread messages? | **NO** — notification bell shows orders/payments, not messages | **MISSING** |

The operator dashboard has **zero messaging infrastructure**. Customer portal messages are emailed out and vanish from the platform entirely. There is no `messages`, `conversations`, or `communications` table in the database.

---

## Summary

| Status | Count |
|--------|-------|
| **FULLY WORKING** | 11 |
| **PARTIALLY WORKING** | 12 |
| **DEFINED BUT NOT CALLED** | 7 (all SMS) |
| **MISSING** | 14 |

### Top 10 Most Impactful Communication Gaps

| Priority | Gap | Impact |
|----------|-----|--------|
| 1 | **No event-day reminders** | Customers forget dates, show up unprepared, or miss deliveries. Operators get no-shows. |
| 2 | **SMS completely unwired** | 7 SMS templates built, Twilio integration complete, UI toggles work — but `sendSmsNotification()` is never called anywhere. Operators who configure SMS get zero value. |
| 3 | **No operator→customer messaging in dashboard** | Operators can't proactively contact customers about booking details, setup instructions, or issues without leaving the platform. |
| 4 | **No dashboard inbox/message center** | Customer portal messages vanish into operator email. No way to see communication history per order or per customer in the dashboard. |
| 5 | **Contact form goes to Korent, not operator** | `lib/contact/actions.ts` sends to hardcoded `support@korent.app`. On a tenant storefront like `joes-bouncing.korent.app`, customer expects to reach Joe, not the platform. |
| 6 | **Notification read state not persisted** | Dashboard notifications reset to unread on every page load. No `notifications` table. Operator can't tell what they've already seen. |
| 7 | **No billing failure email to operator** | Stripe webhook updates DB status to `past_due` but operator gets no email warning — their service could be disrupted silently. |
| 8 | **Delivery status email has no actual delivery details** | "Your delivery has been scheduled" email is generic — missing the time window, crew name, or setup notes that the operator configures per order. |
| 9 | **No post-event follow-up** | No automated "thank you", review request, or rebooking offer. Major missed opportunity for repeat business. |
| 10 | **No onboarding email sequence** | New operators get no welcome email, setup guidance, or activation nudges after signing up. |
