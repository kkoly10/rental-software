# RBAC / RLS verification suite

`rbac.spec.ts` exercises the **real** security boundary: it signs in as three
real Supabase users (owner, viewer, brand-new invitee) and asserts the
row-level-security matrix directly against the PostgREST + RPC API. Unlike the
demo-mode smoke suite, this catches things service-role SQL can't — service-role
bypasses RLS, so it never sees policy recursion or a viewer actually being
blocked. (This suite is how the `organization_memberships` policy recursion —
which broke all team role management — was found.)

It is **env-gated**: with no `RBAC_SUPABASE_URL` every test skips, so it never
runs in the demo-mode CI smoke job. To run it against a project you need the
fixture below seeded, then:

```bash
RBAC_SUPABASE_URL=https://<ref>.supabase.co \
RBAC_ANON_KEY=<anon key> \
RBAC_TEST_PASSWORD='Rbac-Passw0rd!' \
RBAC_ORG_ID=... RBAC_ORDER_ID=... RBAC_ORDER_ITEM_ID=... \
RBAC_VIEWER_ID=... RBAC_INVITE_TOKEN=rbac-pw-invite-token \
npm run test:rbac
```

## Fixture

Three confirmed users on `@rbac-pwtest.invalid` (password `Rbac-Passw0rd!`):
owner (membership `owner`), viewer (membership `viewer`), new-invitee (no
membership). Plus a test org, a `confirmed` order + one order_item, and a
`pending` team_invite (token `rbac-pw-invite-token`, role `dispatcher`) for the
new-invitee's email.

Seeding requires elevated DB access (it inserts confirmed `auth.users` rows with
`pgcrypto` bcrypt passwords and the empty-string GoTrue token columns). Seed via
a service-role/SQL path in CI; the `auth.users` rows must set
`email_confirmed_at` and `confirmation_token/recovery_token/email_change*/
phone_change*/reauthentication_token = ''` (GoTrue errors on NULL there), with a
matching `auth.identities` row (`provider='email'`, `identity_data` containing
`sub` + `email`).

## Teardown

Delete the org's `order_items`/`orders`/`customers`/`team_invites`/
`organization_memberships`/`organizations`, then `auth.identities` + `auth.users`
for `%@rbac-pwtest.invalid`.
