# Space8 Auth & Registration — Implementation Plan

**Date:** 2026-09-14  
**Status:** Planning  
**Based on:** Complete System Specification (Final)

This document maps every row in the spec's error tables to concrete implementation tasks, prioritized for incremental delivery.

---

## 🎯 Implementation Status Summary

### ✅ Completed
- **Section 0:** Profile Complete single source of truth
  - File: `lib/auth/profile-complete.ts`
  - Function: `checkProfileComplete()` checks all 5 criteria
  - Helper: `requireCompleteProfile()` for route guards

- **Section 4 Foundation:** Unified OTP error handling module
  - File: `lib/auth/otp-errors.ts`
  - All error types mapped with distinct messages
  - Recovery actions specified for each case

- **Engagelab Error Mapping:** Complete table (Section 4.1)
  - File: `lib/engagelab/otp.ts`
  - All codes: 3004, 5011, 5013, 5018, 5019, 5020, 6001, 6003, 6006, 6007
  - Helper functions: `canRetryEngagelabError()`, `getEngagelabErrorAction()`

### 🚧 In Progress
- None (awaiting prioritization)

### 📋 TODO (Prioritized)

---

## Priority 1: Critical Path — Phone OTP Registration Fix

**Problem:** New user registration failing with constraint error `users_phone_e164_format`

### Tasks

#### P1.1: Fix `handle_new_user` trigger (URGENT)
- **File:** `supabase/migrations/20260913000000_fix_handle_new_user_phone_format.sql`
- **Status:** Migration exists but has SQL syntax error (line 63)
- **Action:**
  1. Fix the COMMENT syntax error (remove string concatenation `||`)
  2. Test migration locally with `supabase db reset`
  3. Deploy to production
  4. Verify: create new user via phone OTP, check `public.users.phone` has `+` prefix

#### P1.2: Verify Engagelab env var
- **Location:** Supabase Dashboard → Edge Functions → Secrets
- **Required:** `ENGAGELAB_OTP_TEMPLATE_ID` (NOT `ENGAGELAB_SUPABASE_TEMPLATE_ID`)
- **Action:** Confirm env var is set with correct name
- **Test:** Send phone OTP to new number, verify SMS arrives

#### P1.3: Test complete new user flow
- **Steps:**
  1. Use BRAND NEW phone number (never registered before)
  2. Sign in with phone OTP
  3. Enter OTP code
  4. Complete profile (add email, name, terms)
  5. Verify account reaches `onboarding_status = 'complete'`

---

## Priority 2: Section 4 — OTP Error Handling (Send & Verify)

### P2.1: Add missing translation keys
**File:** `messages/zh-HK.json` (and en, zh-CN, ja)

```json
{
  "auth": {
    // Section 4.1: Send errors
    "err_code_already_sent": "你已有一個有效驗證碼，請輸入你收到的驗證碼",
    "err_phone_rate_limited": "此號碼最近請求驗證碼過於頻繁，請稍後再試",
    "err_phone_format": "電話號碼格式不正確，請檢查後重新輸入",
    "err_phone_blacklisted": "此號碼目前無法接收訊息，請改用 Email 註冊或聯絡客服",
    "err_phone_disconnected": "無法送達，請確保你的手機已開機，或改用 Email 註冊",
    "err_sms_unavailable": "SMS 暫時無法使用，請改用 Email 註冊",
    
    // Section 4.2: Verify errors (already exist, verify completeness)
    // "err_otp_expired": "驗證碼已過期，請重新索取",
    // "err_otp_wrong": "驗證碼不正確，尚餘 {count} 次機會",
    // "err_otp_locked": "錯誤次數過多，請重新開始"
  }
}
```

### P2.2: Integrate `otp-errors.ts` into `AuthCard.tsx`

**Current:** `AuthCard.tsx:419-437` uses Supabase `signInWithOtp` with basic error mapping  
**Target:** Use `mapSupabaseSendError()` for all send errors

**Changes:**
1. Import `{ mapSupabaseSendError, mapSupabaseVerifyError }` from `lib/auth/otp-errors.ts`
2. Replace current error handling in `sendContactOtp()` (line ~407)
3. Replace error handling in `verifyOtp()` (line ~617)
4. Add attempt counter logic for verify errors
5. Show distinct messages for "expired" vs "wrong code"

**Files to modify:**
- `components/auth/AuthCard.tsx:359-454` (sendContactOtp)
- `components/auth/AuthCard.tsx:617-692` (verifyOtp)

### P2.3: Integrate `otp-errors.ts` into `ProfileCompletion.tsx`

**Current:** `ProfileCompletion.tsx:199-247` uses Supabase `updateUser` for phone  
**Target:** Use shared error handling

**Changes:**
1. Import error mappers from `lib/auth/otp-errors.ts`
2. Replace error handling in `sendPhoneCode()` (line ~199)
3. Replace error handling in `verifyPhone()` (line ~251)
4. Use `mapSupabaseVerifyError()` for attempt countdown

**Files to modify:**
- `components/auth/ProfileCompletion.tsx:199-247` (sendPhoneCode)
- `components/auth/ProfileCompletion.tsx:251-339` (verifyPhone)

### P2.4: Engagelab-specific error UI enhancements

**Requirement:** Each Engagelab error needs appropriate UI response

| Error Code | Action | UI Change |
|------------|--------|-----------|
| 3004 | Route to OTP entry | Auto-advance to OTP screen, pre-fill phone |
| 6001 | Show countdown | Disable send button, show timer |
| 5013, 5019 | Force method switch | Hide phone option, show email prominently |
| 6006, 6007 | Force method switch | Show "SMS unavailable" notice |

**Implementation:**
- Add `errorAction` state to AuthCard
- Conditionally render UI based on `getEngagelabErrorAction()`

---

## Priority 3: Section 2 — OAuth Error Handling

### P3.1: OAuth error table implementation

**Files to create/modify:**
- New: `lib/auth/oauth-errors.ts` (error mapper)
- Modify: `components/auth/AppleSignInButton.tsx`
- Modify: `components/auth/GoogleSignInButton.tsx`

**Error cases to handle:**

| Case | Current Behavior | Target Behavior |
|------|------------------|-----------------|
| User cancels consent | ❌ Shows generic error | ✅ Silent return to entry screen |
| `access_denied` | ❌ Shows raw OAuth error | ✅ "Sign-in was cancelled or failed — please try again." |
| Network error during exchange | ❌ Generic error | ✅ "Sign-in processing failed — please try again." + server log |
| Apple private relay email | ❓ Unknown | ✅ Treat like normal email |

**Implementation steps:**
1. Create `lib/auth/oauth-errors.ts` with error classifier
2. Update OAuth buttons to use new error handling
3. Add server-side logging for exchange failures
4. Test: cancel Apple consent, verify silent return

### P3.2: OAuth account resolution logic

**⚠️ REQUIRES EXPLICIT APPROVAL FROM LUCA BEFORE SHIPPING**

**Scenario:** OAuth returns email that matches existing OTP-created account

**Current behavior:** Unknown (likely creates duplicate or fails)

**Proposed behavior:** Auto-link to existing account

**Rationale:** Email verified by two independent sources (OTP + OAuth provider)

**Security consideration:** Low risk for HK phone + email combo

**Implementation:**
1. Document decision in `docs/AUTH_DECISIONS.md`
2. Get explicit approval from Luca
3. Implement in OAuth callback handler
4. Add audit logging for all auto-links

**Alternative (if declined):**
Show error: "This email is already registered. Please sign in with your original method."

---

## Priority 4: Section 3 — Password Login Error Refinement

### P4.1: Distinguish "wrong password" from "no password set"

**File:** `components/auth/AuthCard.tsx:552-615` (signInWithPassword)

**Current:** Generic "incorrect password" for all auth failures

**Target:**
- Wrong password: "Incorrect password — please try again or use 'Forgot password'."
- No password set: "This account doesn't have a password set. Use OTP sign-in instead, or add a password from Settings after logging in."

**Detection method:**
- Supabase returns `invalid_credentials` for both cases
- Need to check if account exists with password: query `auth.users` for `encrypted_password IS NULL`
- OR: try OTP sign-in as fallback suggestion

**Translation keys needed:**
```json
{
  "err_password_wrong": "Incorrect password — please try again or use 'Forgot password'.",
  "err_password_not_set": "This account doesn't have a password set. Use OTP sign-in instead, or add a password from Settings after logging in."
}
```

### P4.2: Rate limiting with countdown

**Current:** Shows generic "too many attempts"

**Target:** "Too many attempts — please try again in {X} seconds" with real countdown

**Implementation:**
- Parse `retry-after` header from Supabase response
- Show countdown timer (reuse existing cooldown logic from OTP)

---

## Priority 5: Section 5 — Profile Completion Edge Cases

### P5.1: "Already in use" special handling

**File:** `components/auth/ProfileCompletion.tsx:293-305`

**Current:** Generic "此電話號碼已連結至其他帳戶"

**Target:** "This [email/phone] is already linked to another account. If that's you, sign in with it instead." + button that pre-fills identifier

**Implementation:**
1. Add translation key with dynamic field type
2. On error, show button "Sign in with this [email/phone]"
3. Button calls `onSwitchToSignIn(identifier)` prop
4. Parent (AuthCard) transitions to login with pre-filled value

**New props for ProfileCompletion:**
```typescript
onSwitchToSignIn?: (identifier: string, type: 'email' | 'phone') => void
```

### P5.2: Session expiry handling

**Current:** Hard failure if session expires mid-form

**Target:**
1. Attempt silent token refresh
2. If refresh fails: persist form data to localStorage
3. Show: "Your session has expired — please sign in again"
4. After re-auth: restore form with previously entered values

**Implementation:**
- Add session expiry detector (check `supabase.auth.onAuthStateChange`)
- localStorage keys: `profile_completion_cache_{userId}`
- Clear cache after successful completion

### P5.3: Email verification sub-step

**Status:** Already implemented (lines 342-427)

**TODO:** Verify completeness against spec
- ✅ Send email OTP
- ✅ Verify email OTP
- ✅ Error handling (rate limit, wrong code, expired)
- ✅ Return to form after verification

**Action:** Test flow, ensure all error cases covered

---

## Priority 6: Section 6 — Route Guards

### P6.1: Implement unified gating for booking/member pages

**Files to create:**
- `lib/auth/route-guards.ts` (reusable guard functions)

**Files to modify:**
- `app/[locale]/book/page.tsx`
- `app/[locale]/member/page.tsx` (if exists)
- Any other protected routes

**Guard logic:**
```typescript
export async function requireAuth(redirectPath?: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { redirect: `/login?redirect=${encodeURIComponent(redirectPath || '/')}` }
  }
  
  const check = await checkProfileComplete(supabase)
  if (!check.isComplete) {
    return { redirect: `/complete-profile?redirect=${encodeURIComponent(redirectPath || '/')}` }
  }
  
  return { user, profile: check.user }
}
```

### P6.2: Validate redirect parameter (security)

**Requirement:** Prevent open redirect vulnerability

**Current:** Unknown if validation exists

**Target:** Only accept internal relative paths

**Implementation:**
```typescript
function validateRedirect(redirect: string | null): string {
  if (!redirect) return '/'
  
  // Only allow relative paths starting with /
  if (!redirect.startsWith('/')) return '/'
  
  // Reject protocol-relative URLs (//evil.com)
  if (redirect.startsWith('//')) return '/'
  
  // Reject data: javascript: etc
  if (redirect.includes(':')) return '/'
  
  return redirect
}
```

**Files to modify:**
- All pages that read `?redirect=` param
- AuthCard callback handling

---

## Priority 7: Section 1 — Entry Screen Format Detection

### P7.1: Enhance phone format detection

**Current:** `AuthCard.tsx:302-333` (detectContactType)

**Status:** Already handles +852, 852, and 8-digit formats

**TODO:** Add edge case tests
- Test: `+85266009975` (with country code)
- Test: `85266009975` (without +)
- Test: `66009975` (8 digits only)
- Test: autofill formats from browsers

**Action:** Write unit tests for `detectContactType()`

### P7.2: Inline format hint

**Current:** Shows red border + error message below input

**Target:** Real-time inline hint as user types

**Enhancement:**
- Show format guide below input when focused
- "8 digits (e.g. 6600 9975) or email (e.g. you@example.com)"
- Only show error after blur or submit attempt

---

## Priority 8: Section 7 — Concurrency & Edge Cases

### P8.1: Test concurrent signups (same phone)

**Test case:** Two tabs/devices sign up with same NEW phone simultaneously

**Expected:** UNIQUE constraint on `auth.users.phone` causes second request to fail gracefully

**Action:**
1. Write test script (Playwright or manual)
2. Verify error message guides to "account exists" flow
3. Document behavior in this file

### P8.2: Session expired in stale tab

**Test case:** User logged out in tab A, tab B still has form open

**Expected:** Next submit in tab B shows "session expired" + preserves form data

**Action:**
1. Add session check before every API call
2. On 401: trigger session expiry handler (already planned in P5.2)
3. Test manually

---

## Testing Checklist (Per Section)

### Section 0: Profile Complete
- [ ] `checkProfileComplete()` returns false when any field missing
- [ ] Returns true only when all 5 criteria met
- [ ] Handles missing user gracefully

### Section 1: Entry Screen
- [ ] Detects 8-digit phone (66009975)
- [ ] Detects +852 prefix (+85266009975)
- [ ] Detects 852 prefix without + (85266009975)
- [ ] Detects email (user@example.com)
- [ ] Shows error for invalid format (abc123)

### Section 2: OAuth
- [ ] User cancels Apple consent → silent return
- [ ] Network error during exchange → user-friendly message
- [ ] Private relay email (@privaterelay.appleid.com) → works normally
- [ ] OAuth email matches existing account → (behavior TBD by Luca)

### Section 3: Password Login
- [ ] Wrong password → "Incorrect password"
- [ ] Account exists, no password set → "Use OTP sign-in instead"
- [ ] Rate limited → shows countdown

### Section 4: OTP Send
- [ ] Network timeout → "Network issue"
- [ ] Rate limited (429) → countdown timer
- [ ] Engagelab 3004 → route to OTP entry
- [ ] Engagelab 6001 → phone-level rate limit message
- [ ] Engagelab 5011/5020 → format error
- [ ] Engagelab 5013/5019 → blacklist, suggest email
- [ ] Engagelab 5018 → phone disconnected
- [ ] Engagelab 6006/6007 → service unavailable, force email
- [ ] reCAPTCHA fails → silent retry, then error

### Section 4: OTP Verify
- [ ] Wrong code, attempts left → "Incorrect, {N} attempts left"
- [ ] Attempts exhausted → "Too many incorrect attempts"
- [ ] Expired (distinct from wrong) → "This code has expired"
- [ ] Network failure → doesn't decrement counter
- [ ] Supabase rate limit → "Too many requests"
- [ ] Back button → returns with value populated

### Section 5: Profile Completion
- [ ] Empty name → "Please enter a valid name"
- [ ] Second identity already in use → special message + prefill button
- [ ] Second identity already on THIS account → advance silently
- [ ] Terms not checked → "Please agree to Terms"
- [ ] OTP errors → reuse Section 4 handlers
- [ ] Session expires → persist form + restore after re-auth

### Section 6: Gating
- [ ] Not logged in → redirect to login with ?redirect=
- [ ] Logged in, incomplete profile → redirect to complete-profile
- [ ] Profile complete → allow access
- [ ] Redirect param validation → rejects external URLs

### Section 7: Concurrency
- [ ] Two tabs signup same phone → second fails gracefully
- [ ] Logged out in other tab → session expiry handler

---

## Migration & Deployment Plan

### Phase 1: Foundation (Can deploy independently)
1. ✅ Profile complete checker (`lib/auth/profile-complete.ts`)
2. ✅ OTP error module (`lib/auth/otp-errors.ts`)
3. ✅ Engagelab error mapping update
4. 🚧 Fix `handle_new_user` trigger migration
5. 🚧 Add translation keys

### Phase 2: Core Flows (Deploy together)
1. Integrate OTP errors into AuthCard
2. Integrate OTP errors into ProfileCompletion
3. OAuth error handling
4. Password login refinement
5. Route guards

### Phase 3: Enhancements (Deploy incrementally)
1. Profile completion edge cases
2. Session expiry handling
3. Concurrency tests
4. Format detection improvements

---

## Open Questions (Require Decisions)

### Q1: OAuth Auto-Link (BLOCKER for Section 2.2)
**Question:** When OAuth returns an email that matches an existing OTP-created account, should we auto-link?

**Options:**
- A: Auto-link (low risk, better UX)
- B: Show error, require manual sign-in with original method

**Decision:** ⏳ Awaiting Luca's approval

**Impact:** Cannot complete Section 2.2 until decided

### Q2: Password "Not Set" Detection
**Question:** How to distinguish "wrong password" from "no password set" when both return `invalid_credentials`?

**Options:**
- A: Query `auth.users.encrypted_password IS NULL` (requires service role)
- B: Always suggest OTP as fallback (simpler, no auth query needed)
- C: Track password state in `public.users.has_password` column

**Recommendation:** Option B (simpler, no security risk)

### Q3: Email OTP Provider
**Question:** Current email OTP implementation status?

**Current:** `app/api/auth/send-email-otp/route.ts` exists

**TODO:** Verify it uses Resend and handles all Section 4.1 errors

---

## Files Summary

### New Files Created
- ✅ `lib/auth/profile-complete.ts` (Section 0)
- ✅ `lib/auth/otp-errors.ts` (Section 4 foundation)
- 📋 `lib/auth/oauth-errors.ts` (Section 2, TODO)
- 📋 `lib/auth/route-guards.ts` (Section 6, TODO)
- 📋 `docs/AUTH_DECISIONS.md` (Decision log, TODO)

### Files to Modify
- 📋 `supabase/migrations/20260913000000_fix_handle_new_user_phone_format.sql` (fix syntax)
- 📋 `lib/engagelab/otp.ts` (✅ done, needs deployment)
- 📋 `components/auth/AuthCard.tsx` (integrate otp-errors)
- 📋 `components/auth/ProfileCompletion.tsx` (integrate otp-errors)
- 📋 `components/auth/AppleSignInButton.tsx` (OAuth errors)
- 📋 `components/auth/GoogleSignInButton.tsx` (OAuth errors)
- 📋 `messages/zh-HK.json` (add translation keys)
- 📋 `messages/en.json` (add translation keys)
- 📋 `messages/zh-CN.json` (add translation keys)
- 📋 `messages/ja.json` (add translation keys)
- 📋 `app/[locale]/book/page.tsx` (add route guard)
- 📋 `app/[locale]/member/page.tsx` (add route guard, if exists)

---

## Next Steps

1. **IMMEDIATE:** Fix P1.1 (handle_new_user trigger syntax error)
2. **IMMEDIATE:** Verify P1.2 (Engagelab env var)
3. **IMMEDIATE:** Test P1.3 (complete new user flow)
4. **DECISION NEEDED:** Q1 (OAuth auto-link) — blocks Section 2.2
5. **START:** P2.1 (add translation keys) — enables all other UI work
6. **START:** P2.2 (integrate otp-errors into AuthCard) — highest impact

---

## Success Criteria

This implementation is complete when:

1. ✅ Every row in every error table (Sections 2-7) has a distinct, tested handler
2. ✅ `checkProfileComplete()` is the single source of truth, called from every gating route
3. ✅ `npx tsc --noEmit` passes
4. ✅ All test cases in "Testing Checklist" pass
5. ✅ OAuth auto-link decision documented and implemented
6. ✅ Merged to `main` branch
7. ✅ Deployed to production and verified with real user flow

**Estimated effort:** 12-16 hours of focused development + 4-6 hours testing

**Recommended approach:** Work through priorities 1-8 in order, deploying after each phase.
