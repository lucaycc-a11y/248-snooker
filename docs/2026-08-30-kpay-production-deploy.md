# 2026-08-30 KPay Production Deployment Log

## Purpose

Deployment-trigger commit. Ensures Vercel builds the latest `main` (which
contains the full `fix/kpay-payment-failed` history after the `05215b5`
merge), replacing the stale production deployment at `f7c313d` which had none
of the KPay lifecycle work.

## Production deployment target verification

After Vercel auto-deploys, verify in the Vercel dashboard (or via API) that the
new production deployment's `githubCommitSha` descends from:

- `e3bc044` fix: preserve booking on failed KPay payment
- `244979d` feat: add payment attempt claim for duplicate-order prevention
- `b25fe7f` db: link payment attempt lifecycle to failure recovery RPC
- `77ef08b` fix: add comprehensive KPay CNP error logging
- `6b90440` feat: email-first signup with password strength requirements
- `238c1b5` fix: unified payment recovery screen for failed/cancelled/timeout

## Remaining manual steps (not part of this commit)

1. **Env var** — set `BOOKING_EXPIRY_CRON_SECRET` in Vercel (production + preview)
   for `/api/booking/expire-stale`.
2. **Supabase migrations** — apply in order (see `KPAY_DEPLOYMENT_CHECKLIST.md`):
   - `supabase/migrations/20260828_kpay_payment_attempts.sql`
   - `supabase/migrations/20260828_payment_attempt_claim.sql`
   - `supabase/migrations/0039_kpay_failure_recovery.sql`
   - `supabase/migrations/0038_expire_stale_bookings.sql`
3. **Verify** — run `scripts/verify-s2*.mjs` suite against the production domain
   (they currently target localhost:3000/3100; point them at production to test
   the real deployed build).
