# KPay Lifecycle Deployment Checklist

## Current Status: Ready for Database Migration

The `fix/kpay-payment-failed` branch contains the complete KPay lifecycle implementation but **requires Supabase migrations to be applied** before the code will work correctly.

---

## Part 1: Database Migrations (Apply to Supabase)

### Project: `wqmciwieiqvnswvspdyz`

Apply these migrations **in order** via Supabase SQL Editor:

### 1. Payment Attempts Table

**File:** `supabase/migrations/20260828_kpay_payment_attempts.sql`

Creates the `payment_attempts` table for duplicate-order prevention with:
- `status`: claimed/pending/succeeded/failed/cancelled/expired
- `provider_order_no`: Links to KPay orderNo after creation
- Unique constraint on `idempotency_key`
- Unique index on active booking attempts (prevents concurrent duplicates)

### 2. Payment Attempt Claim RPCs

**File:** `supabase/migrations/20260828_payment_attempt_claim.sql`

Creates 5 service-role-only functions:
- `claim_payment_attempt(booking_id, user_id, provider, idempotency_key)` - Atomic claim before provider call
- `finalize_payment_attempt(attempt_id, provider_order_no)` - Record KPay orderNo after success
- `fail_payment_attempt(attempt_id, failure_code, failure_reason)` - Mark failed attempt
- `complete_payment_attempt(provider_order_no, provider)` - Mark succeeded after webhook
- `cancel_payment_attempt(booking_id)` - Mark cancelled

### 3. Updated Failure Recovery RPCs

**File:** `supabase/migrations/0039_kpay_failure_recovery.sql`

Updates existing RPCs to integrate with payment attempts:
- `mark_kpay_payment_failed()` - Now also marks payment attempt failed
- `cancel_pending_booking()` - Now also cancels payment attempt
- `retry_payment_failed_booking()` - Unchanged (clears old provider refs)

### 4. Stale Booking Expiry

**File:** `supabase/migrations/0038_expire_stale_bookings.sql`

Creates `expire_stale_bookings()` function that:
- Marks past-due pending/payment_failed bookings as expired
- Releases their held slot locks atomically
- Logs expiry notifications (prevents duplicates)
- Captures affected IDs to avoid stale CTE references

---

## Part 2: Environment Variables

### Vercel Production Environment

Add to Vercel project settings:

```bash
BOOKING_EXPIRY_CRON_SECRET=<generate_random_secret>
```

**Purpose:** Protects `/api/booking/expire-stale` route from unauthorized access.

**Generate secret:**
```bash
openssl rand -base64 32
```

---

## Part 3: Verification (After Deployment)

### 3.1 Verify Database Schema

Run in Supabase SQL Editor:

```sql
-- Check payment_attempts table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_attempts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check all RPCs exist
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN (
  'claim_payment_attempt',
  'finalize_payment_attempt',
  'fail_payment_attempt',
  'complete_payment_attempt',
  'cancel_payment_attempt',
  'expire_stale_bookings'
)
ORDER BY proname;
-- Should return 6 rows

-- Check unique constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'payment_attempts'
  AND constraint_type IN ('UNIQUE', 'PRIMARY KEY');
-- Should see: payment_attempts_pkey, payment_attempts_idempotency_key_unique, payment_attempts_one_active_booking
```

### 3.2 Test Payment Flow

1. **Create a test booking with FPS:**
   - Watch server logs for: `[KPay] createOrder:` → `[checkout/create] success`
   - Verify `payment_attempts` row created with `status='pending'`

2. **Cancel before payment:**
   - Verify `payment_attempts.status` changes to `cancelled`

3. **Complete payment:**
   - After webhook, verify `payment_attempts.status = 'succeeded'`

4. **Test duplicate protection:**
   - Open browser DevTools
   - Submit checkout form
   - While KPay is creating order, submit again rapidly
   - Verify: Only ONE KPay order created (check `payment_attempts` table - should see only one row per booking)

### 3.3 Test Stale Expiry

```sql
-- Manually create a stale pending booking
INSERT INTO bookings (
  id, user_id, date, start_time, end_time, duration_hours,
  status, total_price, table_number, human_code, created_at
) VALUES (
  gen_random_uuid(),
  '<test_user_id>',
  current_date - 1,
  '14:00:00',
  '16:00:00',
  2,
  'pending',
  200,
  1,
  'TEST-STALE',
  now() - interval '2 hours'
);

-- Run expiry function
SELECT expire_stale_bookings();

-- Verify booking marked expired
SELECT status FROM bookings WHERE human_code = 'TEST-STALE';
-- Should return: expired
```

### 3.4 Verify Cron Job

After deployment:

```bash
# Check Vercel cron logs
vercel logs --follow

# Manually trigger (requires auth header):
curl -X POST https://248.formhk.com/api/booking/expire-stale \
  -H "x-booking-expiry-secret: $BOOKING_EXPIRY_CRON_SECRET"

# Should return: {"success":true,"result":{...}}
```

---

## Part 4: What Changed (Code Summary)

### Backend Changes

1. **`app/api/checkout/create/route.ts`**
   - Calls `claim_payment_attempt()` BEFORE `provider.createOrder()`
   - Calls `finalize_payment_attempt()` after KPay success
   - Calls `fail_payment_attempt()` on provider error
   - Returns existing order if concurrent claim detected

2. **`app/api/checkout/status/route.ts`**
   - Maps KPay `success` → `pending_confirmation` (not `confirmed`)
   - Returns distinct states: `cancelled`, `expired`, `payment_failed`
   - Returns safe `failureCode`/`failureReason` from KPay

3. **`app/api/checkout/retry/route.ts`** (new)
   - Calls `retry_payment_failed_booking()`
   - Does NOT create new order (caller creates after reset)

4. **`app/api/checkout/cancel/route.ts`** (new)
   - Calls `cancel_pending_booking()`
   - Atomically cancels booking + releases slots

5. **`app/api/booking/expire-stale/route.ts`** (new)
   - Protected by `BOOKING_EXPIRY_CRON_SECRET`
   - Calls `expire_stale_bookings()`

6. **`app/api/webhooks/kpay/route.ts`**
   - Calls `complete_payment_attempt()` after confirmation
   - Handles renewal orders separately

7. **`lib/payments/kpay.ts`**
   - Enhanced error logging for CNP card orders
   - Logs full HTTP response for diagnosis
   - Returns safe `failureCode`/`failureReason`

### Frontend Changes

1. **`components/checkout/KPayPayment.tsx`**
   - New state: `pending_confirmation`
   - Retry calls `/api/checkout/retry` before creating new order
   - Cancel calls `/api/checkout/cancel`
   - Polling continues through `pending_confirmation`
   - Stops polling only on database `confirmed`

2. **`lib/booking/useOrderConfirmationPolling.ts`**
   - Extended status type with: `pending_confirmation`, `cancelled`, `expired`
   - Parses status response safely
   - Distinguishes provider vs database status

3. **`app/[locale]/book/page.tsx`**
   - Neutral KPay return URL: `redirect_status=returned`
   - Does not trust URL parameter for success/failure
   - Confirmation state includes `cancelled`/`expired` outcomes

4. **`lib/data/getMember.ts`**
   - `getMemberData()` returns confirmed-only bookings
   - `getMemberTicket()` requires `status = 'confirmed'`

5. **`vercel.json`** (new)
   - Cron: `/api/booking/expire-stale` hourly at :13

### Translation Keys Added

```json
{
  "kpay_cancelled": "付款已取消",
  "kpay_cancelled_desc": "此預訂已取消，已釋放時段。",
  "kpay_cancel": "取消預訂"
}
```

---

## Part 5: Known Issues / Pending

### CNP Card Order Error (10:35 incident)

The generic "KPay 建單失敗：未知錯誤" has been fixed with comprehensive logging in commit `77ef08b`.

**Next occurrence will show:**
- Full KPay HTTP response
- Response code/message fields
- Request parameters that triggered error

**To diagnose:** Check server logs for `[KPay] createCnpHostedOrder` entries after next card payment attempt.

---

## Part 6: Rollback Plan

If issues occur after deployment:

### Quick Rollback (Vercel)
```bash
# Revert to previous deployment
vercel rollback
```

### Database Rollback (if needed)

```sql
-- Remove payment attempt functions
DROP FUNCTION IF EXISTS public.claim_payment_attempt;
DROP FUNCTION IF EXISTS public.finalize_payment_attempt;
DROP FUNCTION IF EXISTS public.fail_payment_attempt;
DROP FUNCTION IF EXISTS public.complete_payment_attempt;
DROP FUNCTION IF EXISTS public.cancel_payment_attempt;

-- Remove payment_attempts table
DROP TABLE IF EXISTS public.payment_attempts;

-- Revert failure recovery RPCs to previous version
-- (Re-run the previous migration file)
```

---

## Part 7: Post-Deployment Monitoring

### Key Metrics to Watch

1. **Duplicate Orders**
   ```sql
   SELECT booking_id, COUNT(*) as attempts
   FROM payment_attempts
   WHERE status = 'pending'
   GROUP BY booking_id
   HAVING COUNT(*) > 1;
   -- Should return 0 rows
   ```

2. **Failed Attempts**
   ```sql
   SELECT failure_reason, COUNT(*)
   FROM payment_attempts
   WHERE status = 'failed'
     AND created_at > now() - interval '24 hours'
   GROUP BY failure_reason
   ORDER BY COUNT(*) DESC;
   ```

3. **Stale Expirations**
   ```sql
   SELECT COUNT(*)
   FROM bookings
   WHERE status = 'expired'
     AND updated_at > now() - interval '24 hours';
   ```

4. **Webhook Success Rate**
   ```sql
   SELECT status, COUNT(*)
   FROM webhook_events
   WHERE type LIKE 'kpay.%'
     AND received_at > now() - interval '24 hours'
   GROUP BY status;
   ```

---

## Summary

✅ **Code:** Ready in `fix/kpay-payment-failed` branch  
❌ **Database:** Needs 4 migrations applied  
❌ **Environment:** Needs `BOOKING_EXPIRY_CRON_SECRET` set  
❌ **Testing:** Needs post-deployment verification  

**Critical Path:**
1. Apply database migrations
2. Set environment variable
3. Deploy branch
4. Run verification tests
5. Monitor for 24 hours

**Estimated Time:**
- Migrations: 10 minutes
- Deployment: 5 minutes
- Verification: 20 minutes
- Total: ~35 minutes active work
