# A: /member Guard Fixes

## Changes Made

### 1. validateRedirectUrl Integration
- File: `app/member/components/MemberAuthGuard.tsx`
- Change: Imported `validateRedirectUrl` from `@/lib/auth/route-guards` and wrapped the hardcoded `/member` returnUrl with validation
- Evidence: Lines 6, 35-36, 44
- Protection: Rejects URLs starting with `//`, URLs with dangerous protocols (`javascript:`, `data:`, `file:`, `vbscript:`, `blob:`), non-HTTP(S) protocols, and external domains not in allowlist
- Fallback: Returns `/` if validation fails
- Enhanced: Updated `validateRedirectUrl` implementation to add pre-parse protocol checks and post-parse protocol validation

### 2. Hydration Flash Fix
- File: `app/member/components/MemberAuthGuard.tsx`
- Change: Changed initial `modalOpen` state from `true` to `false` (line 14), then set to `true` in `useEffect` after mount (line 17)
- Evidence: Lines 14, 17
- Benefit: Prevents flash between server-rendered HTML and client hydration by deferring modal open until after mount

### 3. Return Path Verification
- Status: ✅ Confirmed
- Evidence: Lines 25-28
- Logic: `handleAuthComplete()` calls `router.refresh()`, which triggers a full server-side re-render of `/member` page with the new session cookie
- Flow: AuthModal → auth success → `onAuthComplete` callback → `router.refresh()` → server re-fetches with authenticated session → `getMemberDashboardData()` returns data → renders `MemberPageClient`
- Correctness: This is the correct pattern for Next.js App Router to pick up new session state

### 4. Close Behavior Verification
- Status: ✅ Confirmed
- Evidence: Lines 30-33
- Implementation: `handleClose()` calls `router.push("/")` when user closes modal without authenticating
- Correctness: Properly redirects to homepage when user dismisses auth, preventing them from staying on an unauthenticated `/member` page

## Files Modified
- `app/member/components/MemberAuthGuard.tsx` (51 lines → 54 lines, +3 lines)
- `lib/auth/route-guards.ts` (70 lines → 95 lines, +25 lines for enhanced security)
- `lib/auth/__tests__/route-guards.test.ts` (NEW, 85 lines)

## Tests Added
- Comprehensive unit tests for `validateRedirectUrl` covering:
  - Valid relative paths (with/without query strings and hash fragments) ✅
  - Protocol-relative URLs (`//evil.com`) - rejected ✅
  - Absolute URLs with dangerous protocols (`javascript:`, `data:`, `file:`) - rejected ✅
  - HTTP/HTTPS external URLs - rejected (unless in allowlist) ✅
  - Allowed external origins - accepted when in allowlist ✅
  - Malformed/empty URLs - handled safely ✅
- All 15 tests passing
