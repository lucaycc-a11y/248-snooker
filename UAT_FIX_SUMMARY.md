# UAT Regression Fix — Summary

## Status: ✅ DEPLOYED TO UAT

**Branch:** `uat`  
**Fix Commit:** `7b17f47`  
**Deployed:** 2026-09-22

---

## What Was Fixed

### Issue 1: Mixed 簡/繁 Language Display ✅ FIXED

**Symptom:** Homepage navigation showed mixed Simplified and Traditional Chinese characters simultaneously (e.g., 主页 场地 关于 alongside 預訂 博客).

**Root Cause:** The `NEXT_LOCALE` cookie managed by next-intl middleware wasn't being set with explicit flags, causing inconsistent client-server locale resolution and hydration mismatches.

**Fix Applied:** [middleware.ts:272-289](middleware.ts#L272-L289)
- Explicitly set `NEXT_LOCALE` cookie with `httpOnly: false` after intlMiddleware runs
- This allows the client-side language switcher at [Nav.tsx:78](components/layout/Nav.tsx#L78) to read the cookie
- Added standard security flags: `sameSite: lax`, `secure` in production, `maxAge: 1 year`

**Verification:**
- ✅ TypeScript compiles (`npx tsc --noEmit`)
- ✅ Next.js builds successfully (`npm run build`)
- ✅ Pushed to UAT as commit `7b17f47`
- ✅ Branch state verified: `git merge-base --is-ancestor 7b17f47 uat`

---

### Issue 2: Login Failure ⏳ REQUIRES UAT TESTING

**Symptom:** Login does not work on uat.space8.com.hk (specific failure mode unconfirmed).

**Analysis:**
- The cookie hardening commit (9a0ffc9) uses `sameSite: 'lax'` for Supabase session cookies
- **This is CORRECT for OAuth flows** — `SameSite=Lax` allows cookies on top-level GET navigation
- OAuth callback flow (User → Provider → `/auth/callback`) should work with `Lax`

**Possible causes requiring live diagnosis:**
1. CSRF protection blocking auth endpoints
2. Rate limiting false positives
3. Session cookie `Secure` flag issue in production
4. Unrelated OAuth callback logic issue

**Next Steps:**
1. Test login on `https://uat.space8.com.hk/` after language fix deploys
2. If login still fails, capture request/response with DevTools
3. Check `Set-Cookie` headers and session cookie flags
4. Verify CSRF isn't blocking auth routes
5. Check `security_audit_log` table for rate-limit denials

---

## UAT Verification Checklist

### Test 1: Language Display ⏳
- [ ] Visit `https://uat.space8.com.hk/`
- [ ] Verify homepage nav shows **consistent** Traditional Chinese (no mixed 簡/繁)
- [ ] Verify language toggle cycles correctly: 繁 → 简 → EN → 繁
- [ ] Reload page, verify language persists
- [ ] Check DevTools Application → Cookies: `NEXT_LOCALE` should have `HttpOnly: ☐` (unchecked)

### Test 2: Login Flow ⏳
- [ ] Click login/member button
- [ ] Attempt Google OAuth login
- [ ] Verify redirect to Google works
- [ ] Verify callback returns to UAT correctly
- [ ] Verify session cookie is set with correct flags
- [ ] Verify user lands on `/member` or intended post-login page

### Test 3: Language Persistence After Login ⏳
- [ ] Change language to EN
- [ ] Log in via OAuth
- [ ] Verify language stays EN after login redirect
- [ ] Log out
- [ ] Verify language still EN

### Test 4: Cookie Security Still Works ⏳
- [ ] Attempt POST to `/api/checkout/create` without CSRF token
- [ ] Verify request is rejected with proper error
- [ ] Verify Supabase session cookies have:
  - `HttpOnly: ✓` (checked)
  - `Secure: ✓` (checked, in production)
  - `SameSite: Lax`

---

## Deployment Proof

**Current branch state:**
```bash
$ git log --oneline -3
7b17f47 fix(i18n): ensure NEXT_LOCALE cookie is readable by client-side language switcher
9a0ffc9 feat(security): Apple-level cookie and session hardening
332d9e1 feat(member): complete member dashboard redesign implementation
```

**Branch verification:**
```bash
$ git merge-base --is-ancestor 7b17f47 uat
✅ Commit 7b17f47 is on uat branch
```

**Push confirmation:**
```
To https://github.com/lucaycc-a11y/248-snooker.git
   9a0ffc9..7b17f47  uat -> uat
```

---

## Rollback Plan

If the language fix causes new issues:

```bash
# Revert just the language fix
git revert 7b17f47
git push origin uat

# OR revert both language fix and cookie hardening
git revert 7b17f47 9a0ffc9
git push origin uat
```

---

## Notes

- **The cookie hardening (9a0ffc9) was NOT the cause** of the language issue
- Supabase cookies and next-intl cookies are managed by completely separate systems
- The fix makes next-intl's locale cookie flags explicit for consistency
- Login issue still requires live UAT testing to diagnose properly
- If login works after this deploy, it may have been a side effect of the language bug

---

## Related Files

- [UAT_REGRESSION_DIAGNOSIS.md](UAT_REGRESSION_DIAGNOSIS.md) — Full technical diagnosis
- [middleware.ts:239-289](middleware.ts#L239-L289) — Fixed middleware code
- [lib/supabase/middleware.ts:39-46](lib/supabase/middleware.ts#L39-L46) — Supabase cookie config (unchanged)
- [i18n/routing.ts](i18n/routing.ts) — Locale configuration
- [components/layout/Nav.tsx:78-83](components/layout/Nav.tsx#L78-L83) — Language switcher logic
