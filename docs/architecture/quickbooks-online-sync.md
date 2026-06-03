# QuickBooks Online Sync (Sprint 2)

## Why this exists

Per the [competitive positioning master plan](../../COMPETITIVE_POSITIONING_MASTER_PLAN.md), QuickBooks Online sync is the #1 deal-blocker for switching off Goodshuffle Pro — not because QuickBooks is magic, but because operators' accountants live in it and won't change. Goodshuffle charges $39/mo for the integration; Korent includes it on Pro.

Sprint 1 shipped a CSV export quick-win that removed the immediate "do you sync?" sales objection. Sprint 2 ships the real Intuit-certified two-way sync (one-way realised in this PR; reverse direction in Sprint 2.5).

## What ships in this PR (one-way: Korent → QBO)

- OAuth 2.0 connect/disconnect via the Intuit developer-portal app
- Auto-sync: when an order moves to `delivered`, Korent pushes a QBO Customer (find-or-create by display name) + Invoice with line items + delivery fee
- Manual "Sync to QuickBooks" button on the order page for first-time testing and recovery from failed syncs
- Daily reconcile cron (`/api/cron/quickbooks-reconcile`) that retries failed/stale syncs once per hour cool-off
- Settings → Integrations card showing connection state, last sync time, and last sync error
- `quickbooks_invoice_sync` table tracks per-order sync state (QBO ids, attempts, last error)

## What's deferred to Sprint 2.5

- QBO → Korent (pull): webhook listener for customer-merged / account-deleted events
- Token-at-rest encryption via Supabase Vault (tokens are plain in the column today)
- Product/Item upsert (operators map manually for now via QBO's Items table)
- Payment record push (we record the invoice; QBO marks it paid when the operator reconciles the deposit in their bookkeeping)
- Refund / void handling
- Batch operations (the QBO BatchOperation endpoint) for orgs with high invoice volume

## External dependencies (operator/founder responsibility)

The code in this PR is dormant until these are set up:

1. **Register an Intuit developer account** at [developer.intuit.com](https://developer.intuit.com)
2. **Create a QBO sandbox app** in the dev portal
3. **Configure the OAuth redirect URI** to exactly match `QBO_REDIRECT_URI` (e.g., `https://app.korent.com/api/integrations/quickbooks/callback`)
4. **Add the OAuth scopes**: `com.intuit.quickbooks.accounting` and `openid`
5. **Set environment variables** in Vercel:
   - `QBO_CLIENT_ID`
   - `QBO_CLIENT_SECRET`
   - `QBO_REDIRECT_URI`
   - `QBO_ENVIRONMENT` = `sandbox` (initially) or `production` (after certification)
6. **Test in sandbox** with a fake QBO company until 10+ invoices sync successfully
7. **Submit for Intuit certification** — 4-8 weeks of back-and-forth before production access is granted

## Architecture

```
┌────────────────┐                  ┌──────────────────┐
│ Operator hits  │                  │ /connect route   │
│ Connect button │  ─────redirect──▶│ (owner/admin)    │
└────────────────┘                  │ - generate state │
                                    │ - set cookie     │
                                    │ - redirect to    │
                                    │   Intuit auth    │
                                    └─────┬────────────┘
                                          │
                                          ▼
                                    ┌──────────────────┐
                                    │ Intuit authorize │
                                    │ + grant page     │
                                    └─────┬────────────┘
                                          │
                                          ▼
                                    ┌──────────────────┐
                                    │ /callback route  │
                                    │ - verify state   │
                                    │ - exchange code  │
                                    │ - persist tokens │
                                    └─────┬────────────┘
                                          │
                                          ▼
                                    ┌──────────────────┐
                                    │ Org dashboard    │
                                    │ ?qbo=connected   │
                                    └──────────────────┘

When an order hits `delivered`:
┌──────────────────────┐
│ updateOrderStatus    │
│ → status='delivered' │
└──────┬───────────────┘
       │ (fire-and-forget)
       ▼
┌──────────────────────────────────┐
│ syncOrderToQuickBooks            │
│ - load connection                │
│ - ensure fresh tokens (refresh   │
│   if within 60s of expiry)       │
│ - find-or-create QBO Customer    │
│ - create QBO Invoice w/ lines    │
│ - update quickbooks_invoice_sync │
│ - update qbo_last_sync_at        │
└──────────────────────────────────┘

Daily reconcile:
┌──────────────────────────────┐
│ /api/cron/quickbooks-reconcile│
│ (every day @ 06:00 UTC)       │
│ - find connected orgs         │
│ - find failed/missing syncs   │
│   with last attempt > 1h ago  │
│ - re-run syncOrderToQuickBooks│
│ - cap 100 orders/org/run      │
└──────────────────────────────┘
```

## File map

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_040000_quickbooks_online_connection.sql` | Adds qbo_* columns to organizations; creates quickbooks_invoice_sync with RLS |
| `lib/integrations/quickbooks/config.ts` | Env var access + endpoint constants |
| `lib/integrations/quickbooks/client.ts` | OAuth + Accounting API client with auto-refresh on 401 |
| `lib/integrations/quickbooks/connection.ts` | Load/persist/clear OAuth tokens on the org row |
| `lib/integrations/quickbooks/sync.ts` | Push paid Korent invoice → QBO Customer + Invoice |
| `lib/integrations/quickbooks/actions.ts` | `manualSyncOrderToQuickBooks` server action |
| `lib/data/quickbooks-status.ts` | Settings card status snapshot (no tokens leaked) |
| `app/api/integrations/quickbooks/connect/route.ts` | OAuth kickoff (owner/admin only, CSRF state cookie) |
| `app/api/integrations/quickbooks/callback/route.ts` | OAuth callback (state verify, code exchange, persist) |
| `app/api/integrations/quickbooks/disconnect/route.ts` | Revoke at Intuit + clear local connection |
| `app/api/cron/quickbooks-reconcile/route.ts` | Daily reconcile of failed/missing syncs |
| `app/dashboard/settings/page.tsx` (modified) | Renders the QuickBooks integration card + result banner |
| `components/settings/quickbooks-card.tsx` | Connect/disconnect UI |
| `components/orders/sync-quickbooks-button.tsx` | Manual sync trigger on the order page |
| `app/dashboard/orders/[id]/page.tsx` (modified) | Mounts the manual sync button when QBO is connected |
| `lib/orders/actions.ts` (modified) | Auto-fires sync on `delivered` (fire-and-forget) |
| `vercel.json` (modified) | Adds the daily reconcile cron |
| `tests/quickbooks-client.test.ts` | 7 unit tests: URL building, token refresh, 401 retry, 429, network errors |
| `tests/smoke/quickbooks-oauth.spec.ts` | Playwright HTTP smoke: routes exist, refuse unauthed, cron requires secret |

## Security model

- **OAuth state**: opaque random value bound to the user via an HTTP-only `qbo_oauth_state` cookie scoped to `/api/integrations/quickbooks`. Verified in the callback; cookie is burned on success or mismatch.
- **Owner/admin only**: connecting QBO grants Korent the ability to push invoices into the operator's bookkeeping system. Dispatcher and below can't touch the connection.
- **Token storage**: access + refresh tokens live in `organizations.qbo_access_token` / `qbo_refresh_token`. **Plain text for the MVP.** A Sprint 2.5 follow-up moves these to Supabase Vault. Until then, anyone with the Postgres connection string can read them — the same trust boundary as the rest of the org's data.
- **Cron auth**: `/api/cron/quickbooks-reconcile` requires the cron secret (same as the other crons). Public callers get 403.
- **Disconnect on revoke**: clearing the connection always best-effort revokes at Intuit first so a leaked refresh token can't keep being used after disconnect.

## Test coverage

| Layer | Coverage | File |
|---|---|---|
| Client URL building | ✅ | `tests/quickbooks-client.test.ts` |
| Token expiry detection | ✅ | `tests/quickbooks-client.test.ts` |
| 401 retry with refresh + persistence callback | ✅ | `tests/quickbooks-client.test.ts` |
| HTTP status mapping (429, network) | ✅ | `tests/quickbooks-client.test.ts` |
| OAuth route auth gating | ✅ (HTTP smoke) | `tests/smoke/quickbooks-oauth.spec.ts` |
| Cron secret gate | ✅ (HTTP smoke) | `tests/smoke/quickbooks-oauth.spec.ts` |
| End-to-end OAuth round-trip | ⏳ Manual sandbox test | (operator runs after env vars configured) |
| Sync against live Intuit sandbox | ⏳ Manual sandbox test | (operator runs after first connect) |
| Production certification | ⏳ Intuit review process | (4-8 weeks after sandbox verification) |
