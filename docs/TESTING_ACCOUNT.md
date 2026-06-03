# Tester Account

## Email
`comlan11@gmail.com`

## Password
Lives in the operator's password manager. **Never committed to this repo.**

For CI / Playwright tests that need to sign in, add `TESTER_PASSWORD` as a GitHub Actions encrypted secret:

> Repo → Settings → Secrets and variables → Actions → New repository secret

Then reference it in the workflow file as `${{ secrets.TESTER_PASSWORD }}`. The value never appears in logs.

## Usage notes
- This account exists for **manual smoke tests** after each merge to main
- For automated UI tests, the future authed Playwright suite should also use this account
- If the password ever leaks (e.g., appears in a screenshot or chat), rotate it immediately
- Do not use this email for production transactions — it's a test fixture only

## Rotation history
- Initial password set: rotate to a new value first time you read this. The password that was originally shared was visible in plaintext and should not be trusted.
