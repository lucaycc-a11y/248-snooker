# Security Wrapper Application Plan

## ✅ Already Protected (Step 1 Complete)
- `/api/checkout/create` - CSRF + rate limit (both)
- `/api/payment/create-intent` - CSRF + rate limit (both)
- `/api/checkout/cancel` - CSRF + rate limit (both)

## 🎯 High Priority - Auth & Profile Mutations (Step 2)
These modify user credentials/profile and need CSRF protection:

### Auth Endpoints
- `/api/auth/send-otp` - **ALREADY HAS** rate limiting (line 21-24), needs CSRF wrapper
- `/api/auth/send-email-otp` - needs audit
- `/api/auth/send-phone-change-otp` - needs audit
- `/api/auth/complete-password-change` - needs CSRF + rate limit
- `/api/auth/complete-phone-change` - needs CSRF + rate limit
- `/api/auth/signup/route.ts` - needs audit
- `/api/auth/signup/verify-email` - needs audit
- `/api/auth/signup/verify-phone` - needs audit

### Member/Profile Endpoints
- `/api/member/request-password-change` - needs CSRF + rate limit
- `/api/member/request-phone-change` - needs CSRF + rate limit
- `/api/profile/update` - needs CSRF + rate limit
- `/api/profile/complete/bind-phone` - needs audit
- `/api/profile/contact-change/*` - needs audit

## 🔒 Medium Priority - Booking Mutations (Step 3)
- `/api/booking/lock` - slot locking, needs CSRF + rate limit
- `/api/booking/lock/release` - needs CSRF
- `/api/bookings/[id]/reschedule` - needs CSRF + rate limit
- `/api/bookings/[id]/refund` - needs CSRF + rate limit (admin-only?)

## 🛡️ Admin Endpoints (Step 4)
All `/api/admin/*` POST/PUT/PATCH/DELETE need CSRF + stricter rate limits:
- `/api/admin/bookings/[id]/cancel` - booking cancellation
- `/api/admin/bookings/manual-create` - manual booking
- `/api/admin/config` - config changes
- `/api/admin/promos/*` - promo management
- `/api/admin/coupons/*` - coupon management
- `/api/admin/door/*` - door access management
- ... (full list: 50+ admin routes)

## ⚠️ SKIP (Signature-Based Auth, Not Cookie-Based)
These endpoints verify cryptographic signatures and should NOT have CSRF middleware:
- `/api/webhooks/stripe` - Stripe signature verification (line 34)
- `/api/webhooks/kpay` - KPay RSA-SHA256 signature (line 64)

## 📋 Read-Only / Special Cases
- `/api/booking/availability` - GET, no mutation
- `/api/booking/status` - GET, polling only
- `/api/booking/quote` - GET, price calculation
- `/api/gate/*` - maintenance gate (EXPLICITLY OUT OF SCOPE per user)
- `/api/door/*` - door lock API (OUT OF SCOPE per user)
- `/api/dev2/*` - dev panel (OUT OF SCOPE per user)

## Implementation Strategy

### Step 2A: Auth OTP endpoints (already have rate limiting)
These have custom rate limiting logic in the handler. Wrapper will ADD CSRF but must not duplicate rate limiting:
1. Check if rate limit is IP+phone or just IP
2. Apply wrapper with `csrf: true, rateLimit: undefined` OR keep existing rate limit config

### Step 2B: Password/phone change endpoints
Simple pattern: `csrf: true, rateLimit: { bucket, max: 5, windowSeconds: 300, identifierType: 'both' }`

### Step 3: Booking mutations
Pattern: `csrf: true, rateLimit: { bucket, max: 10-20, windowSeconds: 60, identifierType: 'both' }`

### Step 4: Admin endpoints
Pattern: `csrf: true, rateLimit: { bucket, max: 30, windowSeconds: 60, identifierType: 'user' }`
(Admin actions are already behind auth; IP-based limiting less critical)

## Rate Limit Budget Guidelines
- OTP sends: 3-5 per 15min (existing)
- Password/phone changes: 5 per 5min
- Profile updates: 10 per 1min
- Booking locks: 20 per 1min (user may try multiple slots)
- Booking cancels: 10 per 1min
- Admin mutations: 30 per 1min (batch operations)

## Testing Checklist After Each Step
1. Login still works
2. OTP send/verify still works
3. Profile update still works
4. Booking flow still works
5. Admin panel still works
6. Webhooks still process (Stripe + KPay)
7. CSRF rejection returns 403 with clear message
8. Rate limit rejection returns 429
