# Supabase auth email templates

Branded HTML for the four auth emails, shared by BOTH audiences
(operators signing up for the SaaS and marketplace renters/sellers) —
which is why they're branded neutral "Korent", not per-surface.

## How to install

Supabase Dashboard → **Authentication → Emails → Templates**, then for
each template paste the matching file's contents into the "Message
body" field and set the subject:

| Supabase template    | File                  | Suggested subject                  |
| -------------------- | --------------------- | ---------------------------------- |
| Confirm sign up      | `confirm-signup.html` | Confirm your email · Korent        |
| Magic link           | `magic-link.html`     | Your sign-in link · Korent         |
| Reset password       | `reset-password.html` | Reset your password · Korent       |
| Invite user          | `invite.html`         | You've been invited · Korent       |

Notes:

- `{{ .ConfirmationURL }}` / `{{ .Email }}` are Supabase template
  variables — paste as-is, Supabase fills them per email.
- The logo is loaded from `https://korent.app/icon-192x192.png`
  (already in `public/`). If the production domain ever changes,
  update the `<img src>` in all four files.
- Design mirrors `lib/market/notify.ts`'s email shell (table layout,
  inlined styles, Gmail/Outlook-safe) on the Korent orange palette.
- Each template includes a plain-link fallback under the button and an
  "ignore this" line — both matter for auth-email trust and spam
  placement.
