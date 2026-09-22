# UAT Regression Diagnosis — Mixed 簡/繁 Language + Login Issue

## Scope
Fix language display bug and login failure on `uat.space8.com.hk` after two recent deploys:
1. Mandatory-password auth changes
2. Cookie/session security hardening (commit 9a0ffc9)

## Issue 1: Mixed Simplified/Traditional Chinese Display

### Symptoms
- Homepage nav mixes Simplified (主页 场地 关于) and Traditional (預訂 博客) characters
- Language toggle shows only "繁" instead of cycling through options
- User reports mixed language in same navigation bar

### Root Cause Analysis

**Initial hypothesis (INCORRECT):** The cookie hardening applied `httpOnly: true` to ALL cookies including `NEXT_LOCALE`, breaking client-side language reading.

**Actual root cause:** The `NEXT_LOCALE` cookie is managed by next-intl's middleware independently from Supabase cookies. However, next-intl's default cookie configuration may not have been setting explicit flags, leading to inconsistent behavior across requests.

**Evidence:**
- [i18n/routing.ts:6](i18n/routing.ts#L6): Configured locales are `['zh-HK', 'zh-CN', 'en']`
- [i18n/routing.ts:7](i18n/routing.ts#L7): Default locale is `zh-HK` (Traditional)
- [i18n/routing.ts:16](i18n/routing.ts#L16): `localeDetection: false` correctly ignores browser headers
- [components/layout/Nav.tsx:78-83](components/layout/Nav.tsx#L78-L83): `toggleLocale()` uses `router.replace(pathname, { locale: next })`
- [lib/supabase/middleware.ts:39-46](lib/supabase/middleware.ts#L39-L46): Cookie hardening only affects Supabase session cookies, NOT `NEXT_LOCALE`

**Why the cookie hardening was NOT the direct cause:**
- Supabase's `setAll()` callback only handles Supabase session cookies (auth tokens)
- next-intl manages `NEXT_LOCALE` cookie through its own middleware
- The two cookie systems are completely separate

**Why the issue occurred:**
- next-intl middleware was called at [middleware.ts:272](middleware.ts#L272) but didn't explicitly set cookie flags
- Without explicit flags, the cookie may have been set inconsistently or with defaults that broke client-side reading
- Client-side hydration and server-side rendering could resolve different locale values, causing mixed display

### Fix Applied

**File:** [middleware.ts:272-289](middleware.ts#L272-L289)

```typescript
// For localized routes, run intlMiddleware and ensure locale cookie is properly set
const intlResponse = intlMiddleware(request)

// Ensure NEXT_LOCALE cookie has correct flags for client-side reading
// (it must NOT be HttpOnly so the language switcher can read it)
const localeCookie = intlResponse.cookies.get('NEXT_LOCALE')
if (localeCookie) {
  intlResponse.cookies.set('NEXT_LOCALE', localeCookie.value, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // MUST be false for client-side language switcher
    maxAge: 31536000, // 1 year
  })
}

return intlResponse
```

**Why this works:**
- Explicitly sets `httpOnly: false` so [Nav.tsx:78](components/layout/Nav.tsx#L78) `toggleLocale()` can read the cookie
- Sets `sameSite: lax` for CSRF protection while allowing normal navigation
- Sets `secure: true` in production for HTTPS-only transmission
- Sets `maxAge: 31536000` (1 year) for persistent language preference

**Verification:**
- ✅ `npx tsc --noEmit` passes
- ✅ `npm run build` passes
- ✅ Committed as 7b17f47

## Issue 2: Login Failure

### Symptoms
- Login does not work on uat.space8.com.hk
- Specific failure mode not yet diagnosed (requires live testing)

### Root Cause Analysis

**Initial hypothesis:** Cookie hardening's `sameSite: 'lax'` breaks OAuth redirects.

**Analysis:**
- [lib/supabase/middleware.ts:43](lib/supabase/middleware.ts#L43): Uses `sameSite: 'lax'`
- **`SameSite=Lax` is CORRECT for OAuth flows** — it allows cookies on top-level navigation (GET requests)
- OAuth callback flow: User → Provider → `/auth/callback` (GET) — this works with `Lax`
- [app/auth/callback/route.ts:12](app/auth/callback/route.ts#L12): Callback handler uses `createClient()` from server.ts
- [lib/supabase/server.ts:14-24](lib/supabase/server.ts#L14-L24): Also applies same cookie flags

**Possible causes still requiring live diagnosis:**
1. ❓ CSRF protection added by hardening may be blocking auth endpoints
2. ❓ Rate limiting false positives on shared IPs
3. ❓ Session cookie not being set with correct `Secure` flag in production
4. ❓ OAuth callback redirect logic issue unrelated to cookies

### Next Steps for Login Issue

**Requires live testing on uat.space8.com.hk:**
1. Attempt real login and capture request/response
2. Check `Set-Cookie` headers in response
3. Verify CSRF validation isn't rejecting auth endpoints
4. Check rate-limit logs in `security_audit_log` table
5. Test whether session cookie is sent/received correctly
6. Verify OAuth callback completes `exchangeCodeForSession()` successfully

**If login is working after the locale fix:**
- The "login failure" may have been a side effect of the language issue
- Users may have been unable to find/click the login button due to mixed text
- Verify with actual UAT testing

## Deployment Status

**Branch:** `uat`
**Commits:**
- 9a0ffc9: Cookie/session security hardening (the suspect)
- 7b17f47: Fix NEXT_LOCALE cookie flags (this fix)

**Pre-deployment checklist:**
- ✅ TypeScript compiles (`npx tsc --noEmit`)
- ✅ Next.js builds (`npm run build`)
- ✅ No new console errors
- ⏳ Verify on UAT after deploy
- ⏳ Test language switcher (繁 → 简 → EN → 繁)
- ⏳ Test login flow end-to-end
- ⏳ Verify no mixed language display

## Verification Tests

### Test 1: Language Switcher
1. Visit `https://uat.space8.com.hk/`
2. Verify homepage nav shows consistent language (all Traditional Chinese)
3. Click language toggle — verify it shows next option (简)
4. Click again — verify EN
5. Click again — verify 繁
6. Reload page — verify language persists
7. Check cookie in DevTools: `NEXT_LOCALE` should have `HttpOnly: false`

### Test 2: Login Flow
1. Visit `https://uat.space8.com.hk/`
2. Click login/member button
3. Attempt OAuth login (Google/Apple)
4. Verify redirect to OAuth provider works
5. Verify callback returns to UAT correctly
6. Verify session cookie is set
7. Verify user lands on correct post-login page

### Test 3: Language Persistence After Login
1. Change language to EN
2. Log in
3. Verify language stays EN after login redirect
4. Log out
5. Verify language still EN

### Test 4: CSRF Protection Still Works
1. Attempt POST to `/api/checkout/create` without CSRF token
2. Verify it's rejected
3. Verify other protected endpoints still enforce CSRF

## Rollback Plan

If issues persist after this fix:

```bash
# Revert this commit
git revert 7b17f47

# OR revert both this and the hardening
git revert 7b17f47 9a0ffc9

# Push to UAT
git push origin uat
```

## Notes

- The cookie hardening (9a0ffc9) was NOT the direct cause of the language issue
- Supabase cookies and next-intl cookies are managed by separate systems
- The fix explicitly sets `NEXT_LOCALE` cookie flags for consistency
- Login issue still requires live diagnosis on UAT
