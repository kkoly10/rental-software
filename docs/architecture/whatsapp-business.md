# WhatsApp Business notifications (Sprint 4)

## Why this exists

**None of Goodshuffle Pro, Booqable, or InflatableOffice ship native WhatsApp** (verified in the Sprint 1 competitive audit). Yet WhatsApp is the default consumer messaging channel in Mexico, much of Latin America, and increasingly in US Hispanic markets — exactly the populations the master plan calls out as Korent's bilingual wedge. Sprint 4 makes Korent the only rental SaaS that sends order/delivery/payment notifications over WhatsApp natively.

The single highest-leverage net-new feature in the entire 14-week plan. Reuses existing Twilio infrastructure, so there's no new vendor relationship to manage.

## Architecture

Twilio acts as the **WhatsApp Business Solution Provider (BSP)**. Same Twilio Account SID + Auth Token as SMS, same `api.twilio.com/.../Messages.json` endpoint. The only send-time differences:

1. Phone numbers prefixed with `whatsapp:` for both `To` and `From`.
2. **Outside the 24h customer-initiated window**, Meta requires pre-approved templates referenced by `ContentSid`. Korent's notifications are all proactive (we send the customer; they don't message us first), so every notification path uses the template payload.

```
                                ┌──────────────────────────┐
                                │ sendSmsNotification(type)│
                                └──────────┬───────────────┘
                                           │
                            (load customer: sms_opt_in, whatsapp_opted_in,
                             whatsapp_number, preferred_locale)
                                           │
                            (render localized SMS body via existing
                             renderSmsTemplate — preserved fallback path)
                                           │
                                           ▼
                                  ┌─────────────────────┐
                                  │ dispatchCustomerMsg │
                                  └─────────┬───────────┘
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                         ▼                         ▼
        org.whatsapp_enabled   customer.whatsapp_opted_in   template has ContentSid
                  │                         │                         │
                  └─────────────────────────┼─────────────────────────┘
                                            │
                                  all 3 true? ──── no ──► fall back to SMS
                                            │
                                           yes
                                            │
                                            ▼
                       Twilio POST with ContentSid + ContentVariables
                                            │
                                            ▼
                                     success / failure
                                            │
                                  failure ──► fall back to SMS
                                            │
                                           success
                                            │
                                            ▼
                  logCommunication(channel: "whatsapp")
```

The dispatcher is intentionally **fail-open to SMS**. A Meta-template-not-yet-approved state, a transient Twilio error, or a misconfigured ContentSid all silently route through SMS instead. Sprint 4.5 will add per-template approval status to the Settings UI so operators see *why* a notification didn't go through WhatsApp.

## Data model

**Per-customer:**
- `customers.whatsapp_opted_in` boolean (default false) — TCPA-style opt-in, independent of `sms_opt_in`. Customer may want one channel but not the other.
- `customers.whatsapp_number` text (nullable) — defaults to `customers.phone` when null. Set only when the customer's WhatsApp number differs from their primary phone.

**Per-org:**
- `organizations.whatsapp_enabled` boolean (default false) — org-level kill switch. Off until the operator completes Twilio + Meta sender approval.
- `organizations.whatsapp_sender_id` text — the Twilio WhatsApp sender number in E.164 (with or without the `whatsapp:` prefix; the action strips it).

**Per-template (env-var driven):**
Each `WhatsAppTemplateKey` maps to a `WHATSAPP_TEMPLATE_*` env var that holds the Twilio ContentSid created when Meta approves the template body. The mapping lives in `lib/messaging/whatsapp-templates.ts` so a future template-rev only touches one file.

**Communication log:**
The `communication_log.channel` CHECK constraint is widened to accept `'whatsapp'`. The Settings → Activity comm log now renders a "WhatsApp" badge when a notification went through that path.

## Templates and variables

Korent ships seven Meta-template-ready bodies. Each one's variable ordering is documented inline in `whatsapp-templates.ts`. **The body strings must match the Meta-approved template verbatim** — when revising, re-submit and update the ContentSid env var.

| Key | Variables (1-indexed) |
|---|---|
| `orderConfirmation` | businessName, orderNumber |
| `depositReminder` | businessName, orderNumber, amount |
| `deliveryScheduled` | businessName, orderNumber, date, timeWindow |
| `deliveryEnRoute` | businessName, orderNumber, eta, trackingUrl |
| `deliveryCompleted` | businessName, orderNumber |
| `weatherAlert` | businessName, orderNumber, forecast |
| `paymentReceived` | businessName, orderNumber, amount |

Sprint 4's eligible WhatsApp keys are the 5 lifecycle ones (orderConfirmation through deliveryCompleted). `weatherAlert` and `paymentReceived` stay SMS-only for the initial Meta submission — they can be added in a follow-up without code changes once the templates are approved.

## External setup (founder/operator)

1. **Twilio**: enable WhatsApp on the Twilio account (Console → Messaging → Try it out → Send a WhatsApp message). Get the sandbox sender number.
2. **Meta Business Manager**: submit each of the 7 template bodies for approval. Use the wording in `whatsapp-templates.ts` verbatim. Approval takes minutes (utility category) to days (marketing).
3. **Twilio Content SID**: once Meta approves, Twilio surfaces a Content SID per template. Add as `WHATSAPP_TEMPLATE_*` env vars in Vercel.
4. **Operator-facing**: turn on the channel via Settings → SMS Notifications → WhatsApp section, set the sender number.
5. **Customer-facing**: the customer must message the Twilio sender from their WhatsApp first to confirm opt-in (Twilio sandbox flow). Production needs the customer to start the conversation via a "click-to-chat" link or have the operator initiate a template message.

Until step 3 is complete, the code stays dormant — every notification falls through to SMS as if WhatsApp wasn't there.

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_070000_whatsapp_business.sql` | `customers.whatsapp_*` + `organizations.whatsapp_*` columns |
| `supabase/migrations/20260603_080000_communication_log_whatsapp.sql` | Widens `communication_log.channel` CHECK to include `whatsapp` |
| `lib/messaging/whatsapp-provider.ts` | Low-level Twilio WhatsApp send (template or freeform) |
| `lib/messaging/whatsapp-templates.ts` | ContentSid registry + positional variable mapping |
| `lib/messaging/dispatch.ts` | Decision tree (WhatsApp → SMS fallback) |
| `lib/sms/send-notification.ts` (modified) | Threads the dispatcher into the existing notification pipeline + records the actual channel in the comm log |
| `lib/communications/log.ts` (modified) | TypeScript channel union widened to include `whatsapp` |
| `lib/data/whatsapp-settings.ts` | Server fetcher for the Settings card |
| `lib/settings/whatsapp-actions.ts` | `updateWhatsAppSettings` server action (owner/admin) |
| `components/settings/whatsapp-settings-form.tsx` | Settings → SMS Notifications → WhatsApp section |
| `app/dashboard/settings/page.tsx` (modified) | Mounts the WhatsApp form below the SMS form |
| `tests/whatsapp-dispatch.test.ts` | 6 unit tests covering the full decision tree |

## Tests

6 unit tests in `tests/whatsapp-dispatch.test.ts` pin every branch of the decision tree:

1. Full happy path: enabled + opted-in + template → Twilio POST with `whatsapp:` prefix + ContentSid
2. Org disabled → falls back to SMS
3. Customer not opted in → falls back to SMS
4. Template ContentSid missing → falls back to SMS
5. Customer-specific `whatsapp_number` overrides `phone` for WhatsApp send
6. `buildVariables` produces the right positional map per template

`globalThis.fetch` is stubbed per-test to verify the exact body Twilio receives.

## Deferred to Sprint 4.5

- **Per-template approval status surface** on the Settings page so operators see "Order Confirmation: approved", "Weather Alert: pending Meta review"
- **Customer-facing opt-in flow** — currently the operator toggles `customers.whatsapp_opted_in` manually; we should send a one-time opt-in confirmation via SMS that says "Reply YES to receive future updates over WhatsApp"
- **Inbound WhatsApp messages** — the existing Twilio inbound webhook (`/api/twilio/inbound`) handles SMS replies; extending it to recognize WhatsApp inbound is a small addition that lands in 4.5
- **Multi-sender per org** — currently each org has one sender id; some operators may want different senders per market
- **WhatsApp-native rich content** (images, location pins, interactive buttons) — Twilio supports it; we don't use it yet
