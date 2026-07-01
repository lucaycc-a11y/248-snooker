# Quick Deployment Guide — Payment Fixes

## Before Deploying

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Environment Variable
In Vercel dashboard or `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 3. Verify Resend Domain
- Go to https://resend.com/domains
- Add `248.formhk.com`
- Update DNS records (Resend will show you what to add)

### 4. Update WhatsApp Number
Edit `lib/stripe/decline-codes.ts` line 99:
```typescript
const whatsappNumber = '852XXXXXXXX'  // Replace with real number
```

## Deploy to Vercel

```bash
git add .
git commit -m "feat(payment): receipt emails + enhanced errors + WhatsApp support"
git push origin feat/booking-payment-backend
```

Then create PR to `main`.

## After Deploy — Verify

### Test Payment Flow
1. Make a test booking on staging
2. Complete payment with test card (4242 4242 4242 4242)
3. Check email inbox for receipt
4. Verify receipt has all details

### Test Error Handling
1. Use Stripe test card that declines: 4000 0000 0000 0002
2. Verify error message shows in Chinese/English
3. Check if WhatsApp button appears (it should for processing errors)

### Check Logs
In Vercel dashboard → Logs:
- Search for `[payment]` — should see confirm_success logs
- Search for `[webhook/stripe] receipt_email_sent` — confirms emails are sending
- Search for `rate_limits` errors — should be ZERO after migration

## Database Migration (If Needed)

If you see `column "bucket" does not exist` errors:

1. Go to Supabase dashboard: https://supabase.com/dashboard/project/wqmciwieiqvnswvspdyz
2. Click SQL Editor
3. Open `supabase/migrations/0003_booking_security_foundation.sql`
4. Copy entire contents
5. Paste into SQL Editor and Run
6. Verify no errors in output

## Rollback Plan

If something breaks:
1. Revert PR in GitHub
2. Redeploy previous version
3. Email sending will stop (but payments still work via existing Stripe flow)
4. Error messages will revert to Stripe's default (still works, just less friendly)

## Support Escalation

If users report payment issues after deploy:
1. Ask them to open browser DevTools (F12)
2. Go to Console tab
3. Look for `[payment]` logs
4. Screenshot and send to dev team

The logs will show:
- Timeout events
- Error codes
- Payment status
- Booking ID

This replaces the previous blind debugging where we had no visibility into client-side payment flow.
