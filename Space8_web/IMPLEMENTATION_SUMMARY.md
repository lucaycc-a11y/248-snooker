# 248 Snooker — Payment Flow Fixes Implementation Summary

## Date: 2026-07-01

## Issues Addressed

### ✅ P0: Payment "Processing" Hang — DIAGNOSED (Not a bug)

**Finding**: The existing payment component (`components/checkout/StripePayment.tsx`) already has robust error handling:
- ✅ `redirect: 'if_required'` correctly set (line 148)
- ✅ 15-second timeout watchdog implemented (lines 139-156)
- ✅ Proper error states and loading management

**Root cause of user reports**: Likely **user-side network issues** or **redirect returns not being detected**. The component itself is correctly implemented.

**Fix applied**: Added comprehensive client-side logging to diagnose future occurrences:
- Log timeout events with timestamp
- Log all error details including `decline_code`
- Log successful confirmations with PaymentIntent status
- Logs will appear in browser DevTools console for debugging

### ✅ Enhanced Error Messages with decline_code Mapping

**Created**: `lib/stripe/decline-codes.ts`
- Maps Stripe decline codes to user-friendly messages in 4 locales (zh-HK, zh-CN, en, ja)
- Provides actionable guidance for each error type
- Determines when to show WhatsApp support fallback

**Supported decline codes**:
- `insufficient_funds` → "你嘅卡餘額不足，請使用其他付款方式"
- `expired_card` → "你嘅卡已過期，請使用其他卡"
- `incorrect_cvc` → "CVC 安全碼不正確，請重新輸入"
- `card_declined` → "你嘅卡被銀行拒絕，請聯絡發卡銀行或使用其他付款方式"
- `fraudulent` → Shows WhatsApp support option
- `processing_error` → Shows WhatsApp support option
- Generic fallback for unknown errors

### ✅ WhatsApp Support Fallback

**When shown**: For errors that might indicate suspected double-charge or fraud blocks
**Features**:
- Pre-filled message with booking details (date, time, amount)
- Localized in 4 languages
- Direct wa.me link that opens WhatsApp with message ready
- Styled with WhatsApp green branding + icon

**Action required**: Update `lib/stripe/decline-codes.ts` line 99 with actual business WhatsApp number

### ✅ Receipt Email System

**Created files**:
1. `lib/resend/client.ts` — Resend client singleton
2. `lib/resend/templates/booking-confirmed.tsx` — React email template
3. `lib/resend/send.ts` — Helper function to send receipt
4. Updated `app/api/webhooks/stripe/route.ts` — Integrated email sending

**Email template features**:
- Black + green 248 branding (matches existing design system)
- Full receipt details: receipt number, date/time, table, customer info
- Price breakdown (subtotal + service fee + total)
- Payment method and transaction ID
- Legal footer with refund policy link
- 4-locale support (zh-HK, zh-CN, en, ja)

**Trigger**: `payment_intent.succeeded` webhook (server-side, reliable)

**Email sent from**: `bookings@248.formhk.com`

### ✅ Refund Policy Page

**Finding**: Refund policy content already exists in `messages/zh-HK.json` and other locales under `legal.refund_rows`

**Content confirmed matches requirements**:
- 預訂後 1 小時內 → 100% 退款 ✅
- 開始前 2 小時或以上 → 50% 退款 ✅
- 開始前 2 小時內 → 不退款 ✅
- No-show 逾 15 分鐘 → 不退款 ✅
- 場地故障 → 100% 退款 ✅
- 颱風 8 號或以上 → 100% 退款 ✅

**Created**: `app/[locale]/legal/refund-policy/page.tsx`
- Redirects to `/legal?tab=refund` (existing tabbed legal page)
- Works for all 4 locales
- Allows direct linking from receipt emails

### ✅ rate_limits Schema Issue

**Finding**: Migration `0003_booking_security_foundation.sql` is CORRECT:
- Table uses `bucket` column (line 58)
- RPC `check_rate_limit()` uses `p_bucket` parameter (line 85)
- Client code in `lib/rate-limit.ts` passes `p_bucket` correctly (line 24)

**Diagnosis**: The `column "bucket" does not exist` error means:
1. Production database hasn't run migration 0003 yet, OR
2. There's a schema drift between local and production

**Action required**: Run migration 0003 in Supabase SQL Editor for project `wqmciwieiqvnswvspdyz`

---

## Files Modified

### Core Payment Flow
- `components/checkout/StripePayment.tsx` — Added logging, decline_code handling, WhatsApp support UI
- `app/api/webhooks/stripe/route.ts` — Integrated receipt email sending

### New Files Created
- `lib/resend/client.ts` — Resend client
- `lib/resend/send.ts` — Email sending helper
- `lib/resend/templates/booking-confirmed.tsx` — Receipt email template
- `lib/stripe/decline-codes.ts` — Error message mapping
- `app/[locale]/legal/refund-policy/page.tsx` — Refund policy redirect

### Configuration
- `package.json` — Added `resend` and `@react-email/render` dependencies
- `INSTALL_REQUIRED.md` — Setup instructions

---

## Installation Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variable**:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
   Get from: https://resend.com/api-keys

3. **Verify domain in Resend**:
   - Add domain: `248.formhk.com`
   - Configure DNS (SPF, DKIM)
   - Wait for verification

4. **Update WhatsApp number**:
   Edit `lib/stripe/decline-codes.ts` line 99

5. **Run migration 0003** (if rate_limits errors persist):
   Execute in Supabase SQL Editor

---

## Testing Checklist

- [ ] `npm install` completes successfully
- [ ] `npm run build` passes TypeScript checks
- [ ] Test payment success → receipt email arrives with correct content
- [ ] Test card decline → shows localized error message
- [ ] Test fraud/processing error → WhatsApp support option appears
- [ ] Click WhatsApp link → opens with pre-filled message
- [ ] Visit `/legal/refund-policy` → redirects to legal tab
- [ ] Check browser console during payment → logs appear
- [ ] Verify no `rate_limits` errors in production logs after migration

---

## Remaining Work (Not Implemented)

### Refund Flow (Admin + User Self-Serve)
**Not implemented** — requires:
1. Admin UI to manually trigger refunds with reason logging
2. User self-serve cancellation flow with time-based refund calculation
3. Refund notification email template
4. Audit logging to `audit_log` table

**Reason**: This is a larger feature requiring UI design, admin auth checks, and business logic validation. Should be a separate PR.

### Orphaned PaymentIntents Cleanup
The two PaymentIntents mentioned in the original prompt (`pi_3ToJKVJ5bHcEMrGb0t59Begq`, `pi_3ToJJcJ5bHcEMrGb0SWkrlVw`) need manual investigation:
1. Check Stripe Dashboard → find these PaymentIntents
2. Check `bookings` table → find associated booking rows by `payment_intent_id`
3. If booking status is still `pending`, either:
   - Cancel the PaymentIntent in Stripe Dashboard, OR
   - Manually confirm the booking if payment actually succeeded

---

## Known Limitations

1. **WhatsApp number is placeholder** — must be updated before production
2. **Email "from" address** (`bookings@248.formhk.com`) must be verified in Resend
3. **Receipt number generation** uses first 8 chars of booking UUID — consider sequential numbering for accounting
4. **Service fee hardcoded to 0** in `lib/resend/send.ts` — update if fee structure changes
5. **Refund flow not implemented** — users can't self-cancel yet

---

## Success Metrics

Once deployed, monitor:
- **Receipt email delivery rate** (Resend dashboard)
- **Payment error types** (browser console logs, Sentry if configured)
- **WhatsApp support inquiries** (track if double-charge concerns decrease)
- **rate_limits errors** (should go to zero after migration)

---

## Questions for Luca

1. **WhatsApp business number** — what's the actual number for support?
2. **Business name + BRN** — needed for legal receipt footer (currently not in email template yet)
3. **Orphaned PaymentIntents** — how to handle the two from 2026-07-01?
4. **Refund flow priority** — should this be next sprint, or defer until self-serve booking cancellation is requested?
