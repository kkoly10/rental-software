# Xero Accounting Sync (Sprint 3.5)

## Why this exists

Goodshuffle Pro has no Xero integration at all. Booqable has it in beta only. Sprint 3.5 ships a production-ready Xero connector at the same shape as the QBO integration so orgs that use Xero (newer / smaller / international operators who chose it over QuickBooks) get the same "tax season is easy" benefit.

The QBO and Xero connectors are intentionally parallel modules rather than a shared abstraction. An accounting-provider interface looks tempting on paper, but the realities of OAuth flavors (PKCE vs not), tenant-resolution shapes (Xero needs a separate `/connections` call), and invoice payload schemas push the abstraction into "abstract by happenstance" territory. Keeping them parallel makes both modules ~300 lines of mostly mechanical work and lets each evolve independently. If a third provider arrives (Wave? FreshBooks?), revisit.

## Xero-specific gotchas vs the QBO equivalent

1. **PKCE is mandatory.** `generatePkcePair()` creates a 64-byte verifier and a SHA-256 challenge. The verifier travels via an HTTP-only cookie alongside the state; both burn on callback.

2. **Tenant id is a separate step.** Xero's OAuth callback doesn't carry the tenant id — we fetch `/connections` immediately after token exchange and take the first connection. Multi-tenant orgs (rare for our SMB target) get a chooser in Sprint 3.7 follow-up.

3. **Tokens are shorter-lived.** Access tokens are 30 minutes (vs QBO's 1 hour). Refresh tokens are 60 days (vs QBO's 100). `ensureFreshTokens` uses the same 60s leeway window.

4. **Headers include `xero-tenant-id` alongside `Authorization`.** Every API call carries both.

5. **Invoice statuses are different.** Xero uses `DRAFT`/`SUBMITTED`/`AUTHORISED`/`PAID`. We default to `AUTHORISED` because by the time the sync fires (on `delivered`), the rental has happened — the invoice is ready to be sent and paid against.

6. **Contact lookup uses Xero's where-clause grammar.** `Name=="..."` filters; result lives at `Contacts[0].ContactID`.

## OAuth flow

```
Operator clicks Connect Xero
   │
   ▼
GET /api/integrations/xero/connect
   - generate state
   - generate PKCE pair
   - set xero_oauth_state + xero_oauth_verifier cookies
   - redirect to Xero authorize
   │
   ▼
Xero authorize page (operator grants access)
   │
   ▼
GET /api/integrations/xero/callback?code=…&state=…
   - verify state cookie
   - exchange code (with verifier) for tokens
   - call /connections → grab first tenantId
   - persist tokens + tenantId
   - burn cookies, redirect to ?xero=connected
```

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260603_060000_xero_connection.sql` | `organizations.xero_*` columns + `xero_invoice_sync` table with RLS |
| `lib/integrations/xero/config.ts` | Env access + endpoint constants |
| `lib/integrations/xero/client.ts` | OAuth (PKCE) + API client with auto-refresh on 401 + tenant header |
| `lib/integrations/xero/connection.ts` | Load/persist/clear connection from `organizations` row |
| `lib/integrations/xero/sync.ts` | Push paid Korent order → Xero Contact + Invoice (ACCREC, AUTHORISED) |
| `lib/integrations/xero/actions.ts` | `manualSyncOrderToXero` server action |
| `lib/data/xero-status.ts` | Settings card status snapshot (no tokens leaked) |
| `app/api/integrations/xero/connect/route.ts` | OAuth kickoff (owner/admin, PKCE + state cookies) |
| `app/api/integrations/xero/callback/route.ts` | State+verifier verify, code exchange, tenant resolve, persist |
| `app/api/integrations/xero/disconnect/route.ts` | Revoke + clear |
| `app/api/cron/xero-reconcile/route.ts` | Daily reconcile (06:30 UTC offset from QBO at 06:00) |
| `components/settings/xero-card.tsx` | Connect/disconnect UI |
| `components/orders/sync-xero-button.tsx` | Manual sync trigger |
| `app/dashboard/settings/page.tsx` (modified) | Renders the Xero card next to QBO with its own banner |
| `app/dashboard/orders/[id]/page.tsx` (modified) | Mounts manual sync button when connected |
| `lib/orders/actions.ts` (modified) | Fire-and-forget Xero auto-sync on `delivered` alongside QBO |
| `vercel.json` (modified) | Adds the Xero reconcile cron |
| `tests/xero-client.test.ts` | 7 unit tests: PKCE pair, authorize URL, token refresh + tenant preservation, tenant header on API, 401 retry, 429, network |
| `tests/smoke/xero-oauth.spec.ts` | Playwright HTTP smoke for auth gating + cron secret |

## Security model

Same as QBO (see `quickbooks-online-sync.md`) with one Xero-specific addition: the PKCE verifier cookie. Same path scope, same 10-minute TTL, same burn-on-callback semantics. Both cookies are required at the callback — missing either fails state validation.

## Deferred to Sprint 3.7

- Multi-tenant chooser UI (operator has authorized multiple Xero organizations and we need to pick one)
- Token-at-rest Vault encryption (shared with QBO migration)
- Xero webhook listener (`webhooks.xero.com`)
- Account-code mapping (operator picks which chart-of-accounts code invoices land in)
- Payment record push (we authorize the invoice; full payment record is Sprint 3.7)
