# RLS Fix Plan — handoff from web Claude session

You (codespace Claude with Supabase MCP authenticated) are picking up
the RLS hardening work from a web Claude session that ran the initial
audit but can't authenticate to the MCP from its sandbox.

Project ref: `gotyqamdmjxadntkvhkk`
Branch to develop on: `claude/bug-audit-2AlQ9`

## Findings already in hand

The manual audit (full notes in PR #134 / #135 context) flagged these
issues, ordered by severity:

### 🔴 HIGH — `driver_locations` open to the internet
- `Anon can read driver locations` (SELECT, anon, qual = `true`):
  any unauthenticated visitor can read every org's driver GPS positions.
- `Org members can upsert driver location` (ALL, authenticated,
  qual = `true` / with_check = `true`): any logged-in user of any org
  can read and write/delete all driver locations for all orgs.

### 🟠 MEDIUM — `documents` portal status tampering
- `Portal users can update document status via signing` (UPDATE, public,
  qual = `true`, with_check = `document_status='signed'`).  An attacker
  can flip any document in any org to "signed."  USING clause must
  identify the specific document via a signing token / row id, not `true`.

### 🟠 MEDIUM — Cross-org write via unconstrained INSERTs
- `notifications → Allow notification inserts` (INSERT, public,
  with_check = `true`): anyone (including anon) can insert notifications
  into any org.
- `communication_log → Authenticated can insert communication_log`
  (INSERT, with_check = `true`): any authenticated user can write
  comm-log rows for any org.

### 🟡 LOW–MEDIUM — Storefront anon reads with no org scoping
- `product_images` and `product_attributes` (qual = `true`): expose
  media/attributes for all products regardless of `is_active` /
  `visibility`, even though `products` itself is correctly gated.
  Likely a real bug — align with the products filter.
- `organizations` anon SELECT (qual = `true`): exposes all org rows.
  Confirm no sensitive columns (billing, internal settings) live on
  this table; switch to a view or column-limited policy if so.
- `categories` (is_active = true) and `service_areas` (is_active AND
  deleted_at IS NULL): cross-org public reads with no org filter.
  Acceptable only if these are meant to be globally public.

### 🟡 LOW — Review intent
- `messages → Anon can insert inbound messages`
  (only guard: `direction='inbound'`): fine if locked-down webhook path.
- `profiles → Allow profile creation via trigger` (with_check = `true`):
  safe if inserts only ever happen via SECURITY DEFINER trigger.

## Plan — execute in this order

### Step 1 — cross-check with the Supabase linter

```
Run get_advisors(type=security) on project gotyqamdmjxadntkvhkk and
show me only the rows that disagree with or extend the manual audit
above.
```

### Step 2 — fix driver_locations (HIGH)

Draft (do NOT apply yet) a migration at
`supabase/migrations/20260601_010000_fix_driver_locations_rls.sql` that:

1. Drops `Anon can read driver locations` (anon SELECT, qual=true).
2. Drops `Org members can upsert driver location`
   (ALL, authenticated, qual=true / with_check=true).
3. Adds replacements scoped via
   `organization_id IN (SELECT get_user_org_ids())`:
   - SELECT for org members
   - INSERT with org check in with_check
   - UPDATE with org check on qual AND with_check
   - DELETE for org members
4. Header comment cites the audit finding.

Print the SQL to me before writing the file so I can review it.  Then
apply via `apply_migration` only after my OK.

After applying, verify with:
```sql
SELECT polname, polcmd, polroles::regrole[],
       pg_get_expr(polqual, polrelid) AS qual,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.driver_locations'::regclass;
```

### Step 3 — fix documents portal UPDATE (MEDIUM)

Migration: `20260601_020000_fix_documents_portal_update_rls.sql`.

Replace `Portal users can update document status via signing` with a
policy whose USING clause matches on a portal token column or a
signing-session row, rather than `true`.  If no such column exists,
add one in the same migration (token UUID + index).

Verify the policy no longer matches arbitrary documents.

### Step 4 — fix notifications + communication_log INSERTs (MEDIUM)

Migration: `20260601_030000_fix_unconstrained_insert_rls.sql`.

- `notifications` `Allow notification inserts`:
  set with_check to `organization_id IN (SELECT get_user_org_ids())`,
  OR restrict to `service_role` if all inserts happen server-side.
  Check the codebase first — `grep -rn "from('notifications').insert"`.
- `communication_log` `Authenticated can insert communication_log`:
  same treatment.

### Step 5 — fix product_images / product_attributes anon reads (LOW-MEDIUM)

Migration: `20260601_040000_fix_storefront_anon_read_rls.sql`.

Replace the qual=true policies with EXISTS-clauses that join to the
parent product and apply the same `is_active AND visibility='public'`
filter that `products` already uses.

### Step 6 — re-run the audit

After each migration is applied, re-run the policy listing query and
confirm the flagged rows are gone.  Then re-run `get_advisors` to
make sure no new issues were introduced.

### Step 7 — open the PR

One PR for all four migrations together, titled
`security: tighten RLS on driver_locations, documents, notifications, communication_log, product_images/attributes`.

Body should list each migration file and the audit finding it closes.
Mark as **draft** and ping for review.  Push to branch
`claude/bug-audit-2AlQ9`.

## Hard rules

- **Never** run `apply_migration` without first printing the SQL and
  waiting for explicit user approval.
- Read-only audits (`execute_sql` with SELECT, `list_tables`,
  `get_advisors`) need no approval.
- One migration per logical fix.  Don't bundle.
- After each `apply_migration`, run the verify query and stop for
  user confirmation before moving to the next step.

## Useful queries

Full policy listing:
```sql
SELECT pc.relname AS table_name,
       pol.polname,
       pol.polcmd,
       pol.polroles::regrole[] AS roles,
       pg_get_expr(pol.polqual, pol.polrelid) AS qual,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
JOIN pg_class pc ON pc.oid = pol.polrelid
WHERE pc.relnamespace = 'public'::regnamespace
ORDER BY pc.relname, pol.polname;
```

`get_user_org_ids()` reference (already exists in your DB):
```
returns SETOF uuid; reads from organization_memberships
where profile_id = auth.uid() and status = 'active'.
```
