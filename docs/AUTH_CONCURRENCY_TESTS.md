# Authentication Concurrency Test Plan

## Overview
This document outlines concurrency and edge case tests for the authentication system, focusing on race conditions, duplicate requests, and state consistency.

## Test Scenarios

### 1. Duplicate OTP Send Requests
**Scenario**: User double-clicks "Send Code" button
- **Expected**: Second request should be rate-limited or return existing code (3004)
- **Test**: Rapid-fire two `signInWithOtp` calls with same phone
- **Validation**: Only one SMS sent, second call returns gracefully

### 2. Concurrent Profile Completion
**Scenario**: Multiple tabs attempting to complete profile simultaneously
- **Expected**: One succeeds, others fail gracefully with appropriate error
- **Test**: Open `/auth` in two tabs, complete profile in both simultaneously
- **Validation**: Database constraint prevents duplicate, UI shows clear error

### 3. Session Expiry During OTP Entry
**Scenario**: User's session expires while entering OTP code
- **Expected**: Clear "session expired" message, redirect to login
- **Test**: Start OTP flow, manually delete session, attempt verification
- **Validation**: `err_session_expired` message shown

### 4. Phone Number Race Condition
**Scenario**: Two users try to register same phone simultaneously
- **Expected**: One succeeds, other gets "phone already exists" error
- **Test**: Two browser tabs, same phone number, submit simultaneously
- **Validation**: Database constraint prevents duplicate, clear error message

### 5. OTP Verification Attempts Exhaustion
**Scenario**: User enters wrong code multiple times
- **Expected**: After 5 attempts, OTP entry locks, requires resend
- **Test**: Enter wrong code 5 times
- **Validation**: UI shows countdown (5→4→3→2→1→0), then locks with "err_otp_locked"

### 6. Rapid OAuth Clicks
**Scenario**: User rapidly clicks Google/Apple sign-in button
- **Expected**: Only one OAuth flow initiated
- **Test**: Rapid-click Google button 5 times
- **Validation**: Only one redirect occurs, no duplicate auth records

## Implementation Tests

### Unit Tests (lib/auth/*.ts)
```typescript
// Test otp-errors.ts
describe('mapSupabaseSendError', () => {
  it('maps rate limit errors correctly', () => {
    const error = { message: 'rate limit exceeded' }
    const result = mapSupabaseSendError(error, t)
    expect(result.type).toBe('rate_limited')
    expect(result.retryAfterSeconds).toBe(60)
  })

  it('handles code already sent (3004)', () => {
    const result = mapEngagelabSendError(3004, t)
    expect(result.action).toBe('retry')
    expect(result.engagelabCode).toBe(3004)
  })
})

describe('mapSupabaseVerifyError', () => {
  it('decrements attempts correctly', () => {
    const error = { message: 'invalid otp' }
    const result = mapSupabaseVerifyError(error, 2, t)
    expect(result.attemptsLeft).toBe(2)
    expect(result.needsResend).toBe(false)
  })

  it('locks after exhaustion', () => {
    const error = { message: 'invalid otp' }
    const result = mapSupabaseVerifyError(error, 0, t)
    expect(result.type).toBe('exhausted')
    expect(result.needsResend).toBe(true)
  })
})
```

### Integration Tests (Playwright)
```typescript
// Test concurrent profile completion
test('prevents duplicate profile completion', async ({ browser }) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()
  
  const page1 = await context1.newPage()
  const page2 = await context2.newPage()
  
  // Both navigate to profile completion
  await Promise.all([
    page1.goto('/auth?complete=true'),
    page2.goto('/auth?complete=true')
  ])
  
  // Fill forms simultaneously
  await Promise.all([
    page1.fill('[name=phone]', '12345678'),
    page2.fill('[name=phone]', '12345678')
  ])
  
  // Submit simultaneously
  await Promise.all([
    page1.click('[type=submit]'),
    page2.click('[type=submit]')
  ])
  
  // One should succeed, one should fail
  const errors = await Promise.all([
    page1.locator('[data-testid=error]').textContent(),
    page2.locator('[data-testid=error]').textContent()
  ])
  
  expect(errors.filter(e => e?.includes('already'))).toHaveLength(1)
})
```

## Manual Testing Checklist

- [ ] P8.1: Double-click OTP send button (should not send duplicate SMS)
- [ ] P8.2: Open profile completion in 2 tabs, submit same phone (one fails gracefully)
- [ ] P8.3: Start OTP flow, delete session cookie, verify (shows session expired)
- [ ] P8.4: Enter wrong OTP 5 times (shows countdown, then locks)
- [ ] P8.5: Rapid-click Google sign-in (only one redirect)
- [ ] P8.6: Register with existing phone (clear "already exists" error)

## Database Constraints Verification

### Existing Constraints
```sql
-- Verify these constraints exist and are working
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass;

-- Expected constraints:
-- 1. users_phone_e164_format (CHECK phone format)
-- 2. users_email_key (UNIQUE email)
-- 3. users_phone_key (UNIQUE phone)
-- 4. users_profile_complete_verified_chk (CHECK profile completion)
```

### Test Database Constraint Enforcement
```sql
-- Test 1: E.164 format enforcement
INSERT INTO users (id, phone) VALUES (gen_random_uuid(), '12345678'); -- Should fail
INSERT INTO users (id, phone) VALUES (gen_random_uuid(), '+85212345678'); -- Should succeed

-- Test 2: Unique phone
INSERT INTO users (id, phone) VALUES (gen_random_uuid(), '+85212345678'); -- Should fail (duplicate)

-- Test 3: Profile completion check
INSERT INTO users (id, name, email, phone, email_verified_at, phone_verified_at) 
VALUES (gen_random_uuid(), 'Test', 'test@example.com', '+85212345678', NULL, NOW()); -- Should fail
```

## Performance Benchmarks

### Target Metrics
- OTP send: < 2s (including SMS delivery)
- OTP verify: < 500ms
- Profile completion: < 1s
- OAuth redirect: < 1s

### Load Testing
```bash
# Simulate 100 concurrent OTP requests
ab -n 100 -c 10 -p otp-payload.json -T application/json \
  https://space8.com.hk/api/otp/send

# Expected: Rate limiting kicks in, no duplicate SMS sent
```

## Monitoring & Alerts

### Key Metrics to Monitor
1. **OTP failure rate**: > 5% triggers alert
2. **Session expiry during auth**: Track count
3. **Duplicate phone registration attempts**: Should be blocked by DB
4. **OAuth failure rate**: > 10% triggers alert
5. **Average OTP delivery time**: > 5s triggers investigation

### Supabase Auth Events
```sql
-- Monitor auth events
SELECT event_type, COUNT(*), AVG(created_at - previous_created_at) as avg_gap
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY event_type
ORDER BY COUNT(*) DESC;
```

## Rollout Plan

1. **Deploy handle_new_user migration** (P1)
2. **Verify Engagelab configuration** (P1)
3. **Deploy OTP error handling** (P2) ✅
4. **Deploy OAuth error handling** (P3) ✅
5. **Deploy password error handling** (P4) ✅
6. **Deploy route guards** (P6) ✅
7. **Run integration tests** (P8)
8. **Monitor for 24 hours** before full rollout
