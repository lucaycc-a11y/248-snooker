# Installation Required

## 1. Install dependencies

Run this command to install the required packages:

```bash
npm install
```

This will install:
- `resend` (v4.0.0) — Email sending service
- `@react-email/render` (v1.0.1) — React email template rendering

## 2. Environment variables

Add to `.env.local` or Vercel environment variables:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Get your API key from: https://resend.com/api-keys

## 3. Verify domain in Resend

Before sending emails, verify your domain (248.formhk.com) in Resend:
1. Go to https://resend.com/domains
2. Add domain: `248.formhk.com`
3. Add the DNS records (SPF, DKIM) provided by Resend
4. Wait for verification (usually takes a few minutes)

## 4. Update WhatsApp number

Edit `lib/stripe/decline-codes.ts` and replace the placeholder WhatsApp number:

```typescript
const whatsappNumber = '85212345678'  // Replace with actual business number
```

## 5. Test in development

```bash
npm run dev
```

Test a booking payment to verify:
- Receipt email is sent after successful payment
- Error messages show proper decline_code mapping
- WhatsApp support link appears for suspicious failures

## 6. Database migration check

If you see `column "bucket" does not exist` errors in production logs, run migration 0003:

```bash
# In Supabase SQL Editor for project wqmciwieiqvnswvspdyz
# Run: supabase/migrations/0003_booking_security_foundation.sql
```

This creates the `rate_limits` table with the correct `bucket` column.

