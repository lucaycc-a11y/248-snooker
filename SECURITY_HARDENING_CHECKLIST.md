# Security Hardening Verification Checklist

## Implementation Status

### A. Remove Non-Essential Cookies ✅
- [x] **Status**: PASS (pre-existing)
- **Evidence**: Site already uses minimal cookies
  - Supabase session cookies (essential)
  - reCAPTCHA cookies (kept per user requirement: "keep recatxha")
  - site_gate_bypass (maintenance mode - not touched per scope)
  - No third-party tracking cookies found

### B. Harden Remaining Cookies ✅
- [x] **Status**: PASS
- **Evidence**: Modified `lib/supabase/server.ts` and `lib/supabase/middleware.ts`
  - Applied cookie options to all Supabase session cookies:
    ```typescript
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }
    ```
- **Manual Verification Required**: Browser DevTools → Application → Cookies
  - Check `sb-` prefixed cookies have HttpOnly=true, Secure=true (production), SameSite=Lax

### C. CSRF Protection on State-Changing Endpoints ✅
- [x] **Status**: PASS (implementation complete, needs runtime verification)
- **Implementation**:
  - Created `lib/security/csrf.ts` (token generation/validation with HMAC-SHA256)
  - Created `lib/security/api-wrapper.ts` (unified security wrapper)
  - Created `lib/security/admin-wrapper.ts` (admin-specific wrapper)
  - Protected endpoints:
    1. `/api/checkout/create` - booking creation
    2. `/api/payment/create-intent` - payment intent creation
    3. `/api/checkout/cancel` - booking cancellation
    4. `/api/auth/complete-password-change` - password change completion
    5. `/api/profile/complete/bind-phone` - phone number binding
    6. `/api/admin/bookings/[id]/cancel` - admin booking cancellation
  - Webhooks exempt from CSRF (signature-verified instead):
    - `/api/stripe/webhook` - Stripe signature verification
    - `/api/kpay/webhook` - KPay signature verification

- **Automated Test**: Run `./scripts/verify-security-hardening.sh` (checks 1-8)
- **Manual Test**: 
  1. Browser console: `fetch('/api/checkout/create', {method:'POST', body:'{}'})`
  2. Should see HTTP 403 (CSRF token missing/invalid)
  3. Get token: `fetch('/api/csrf').then(r=>r.json())`
  4. Retry with token in header: `X-CSRF-Token: <token>`

### D. Rate Limiting on Auth/Booking/Payment Endpoints ✅
- [x] **Status**: PASS (implementation complete, needs runtime verification)
- **Implementation**:
  - All protected endpoints have rate limits via `withSecurity` wrapper
  - Dual tracking: IP-based + user-based (`identifierType: 'both'`)
  - Limits applied:
    - checkout/create: 20 req/60s
    - payment/create-intent: 20 req/60s
    - checkout/cancel: 10 req/60s
    - auth/complete-password-change: 5 req/300s
    - profile/bind-phone: 10 req/300s
    - admin endpoints: 30 req/60s (default)

- **Automated Test**: Run `./scripts/verify-security-hardening.sh` (test #6)
- **Manual Test**: Rapid-fire 25 POST requests to `/api/checkout/create`
  - Should hit HTTP 429 (Too Many Requests) before completing all 25

### E. Audit Log for Security Events ✅
- [x] **Status**: PASS (implementation complete, needs runtime verification)
- **Implementation**:
  - Created migration: `supabase/migrations/20260922000000_security_audit_log.sql`
  - Created table: `security_audit_log` (user_id, ip_address, action, endpoint, details, created_at)
  - Created logger: `lib/security/audit-log.ts`
  - Events logged:
    - CSRF rejections (via `withSecurity`)
    - Rate limit triggers (via `rateLimitWithLogging`)
    - Password changes (existing in auth routes)
    - Admin actions (existing admin_action_log table)

- **Manual Verification**:
  ```sql
  -- Run in Supabase SQL Editor
  SELECT 
    action, 
    endpoint, 
    ip_address, 
    details, 
    created_at 
  FROM security_audit_log 
  ORDER BY created_at DESC 
  LIMIT 20;
  ```
- **Expected**: After running tests, see entries for:
  - `csrf_rejected` from test POSTs without tokens
  - `rate_limit_exceeded` from rapid-fire tests

---

## Deploy & Verification Steps

### 1. Pre-Deploy Checks ✅
- [x] `npm run build` - PASSED
- [x] `npx tsc --noEmit` - PASSED (0 errors)
- [ ] Migration applied to UAT database
  ```bash
  # Run this manually:
  supabase db push --linked
  # Or apply migration file directly in Supabase Dashboard
  ```

### 2. Deploy to UAT ⏳
```bash
# After migration is applied:
git add -A
git commit -m "feat(security): Apple-level cookie and session hardening

- Add HttpOnly, Secure, SameSite=Lax flags to all session cookies
- Implement CSRF protection on all state-changing endpoints
- Add dual rate limiting (IP + user) to auth/booking/payment routes
- Create security_audit_log table for security event tracking
- Protect 6 critical endpoints with unified security wrapper
- Exempt webhooks from CSRF (signature-verified instead)

Scope: CSRF + rate-limit + audit-log only, no business logic changes
Testing: ./scripts/verify-security-hardening.sh"

git push origin uat
```

### 3. Runtime Verification (On UAT)
```bash
# Run automated tests against UAT
./scripts/verify-security-hardening.sh https://uat.space8.com.hk

# Expected results:
# ✓ Tests 1-5: CSRF protection active (HTTP 403)
# ✓ Test 6: Rate limiting triggers (HTTP 429)
# ✓ Tests 7-8: Webhooks bypass CSRF (HTTP 400 signature validation)
# ⊘ Tests 9-15: Manual verification required
```

### 4. Manual Verification Checklist

#### Browser DevTools (Test #9)
- [ ] Open UAT site in Chrome DevTools
- [ ] Navigate to: DevTools → Application → Cookies → https://uat.space8.com.hk
- [ ] Verify Supabase session cookies (`sb-*`) have:
  - ✓ HttpOnly = true
  - ✓ Secure = true
  - ✓ SameSite = Lax
  - ✓ Expires = ~7 days from now

#### Database Audit Log (Test #10)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run:
  ```sql
  SELECT action, endpoint, ip_address, details, created_at 
  FROM security_audit_log 
  ORDER BY created_at DESC 
  LIMIT 10;
  ```
- [ ] Verify entries exist for:
  - `csrf_rejected` (from test script)
  - `rate_limit_exceeded` (from test script)

#### End-to-End Login (Test #11)
- [ ] Log in to UAT with valid credentials
- [ ] Check DevTools → Network → Cookies set
- [ ] Navigate to /member dashboard
- [ ] Verify session persists across page reloads
- [ ] Log out, verify cookies cleared

#### Booking Creation (Test #12)
- [ ] Log in to UAT
- [ ] Select a slot, proceed to checkout
- [ ] Open DevTools → Network → POST /api/checkout/create
- [ ] Verify request has `X-CSRF-Token` header
- [ ] Complete booking creation
- [ ] Verify no CSRF errors in console

#### Password Change (Test #13)
- [ ] Trigger password change email from UAT
- [ ] Click email link, set new password
- [ ] Verify success (no CSRF rejection)
- [ ] Check audit log for `complete_password_change` entry

#### Admin Endpoints (Test #14)
- [ ] Log in as admin user
- [ ] Navigate to admin panel → cancel a test booking
- [ ] Open DevTools → Network → POST /api/admin/bookings/[id]/cancel
- [ ] Verify request has `X-CSRF-Token` header
- [ ] Verify cancellation succeeds
- [ ] Check admin_action_log for entry

#### Rate Limit Recovery (Test #15)
- [ ] Hit rate limit (25 rapid requests)
- [ ] Wait 60 seconds
- [ ] Retry request
- [ ] Verify request succeeds (rate limit window reset)

---

## Rollback Plan

If any critical issue found:
```bash
# Revert to previous commit
git revert HEAD
git push origin uat

# Or rollback to specific commit:
git reset --hard <commit-before-security-changes>
git push origin uat --force
```

Migration rollback (if needed):
```sql
DROP TABLE IF EXISTS security_audit_log;
```

---

## NOT TOUCHED (Per Scope)

- ❌ KPay payment internals
- ❌ Admin iOS app
- ❌ iPad kiosk
- ❌ Door-lock API
- ❌ dev2 panel
- ❌ Homepage/UI
- ❌ i18n system
- ❌ site_gate_* maintenance-gate cookies/logic
- ❌ Booking business logic (pricing, slot selection, etc.)
- ❌ main branch (deploy to uat only)

---

## Summary

**Implementation**: ✅ COMPLETE  
**Build**: ✅ PASSED  
**TypeScript**: ✅ PASSED  
**Deploy**: ⏳ READY (awaiting database migration + push)  
**Verification**: ⏳ PENDING (run after deploy)

**Next Steps**:
1. Apply migration to UAT database
2. Push to uat branch
3. Run automated test script
4. Complete manual verification checklist (tests 9-15)
5. Report PASS/FAIL/NOT TESTED for each item
