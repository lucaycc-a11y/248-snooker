# Regression Fix: Profile Completion Flow + Planet Reveal

## Problem
After implementing the planet-based member code system (commit `41068c8`), two regression issues appeared:

1. **Profile completion flow bypassed**: New users could skip the profile completion step and land directly on `/member` dashboard
2. **Planet reveal animation never shown**: The newly implemented planet reveal animation was never displayed to new members

## Root Cause

The planet reveal feature was correctly implemented in `AuthCard.tsx`, but two critical checks were missing:

### Issue 1: OAuth Callback Missing Profile Check
**File**: `app/auth/callback/route.ts`

The OAuth callback (used by Google/Apple sign-in) was redirecting users directly to their destination (usually `/member`) without checking if `profile_complete === true`. This meant:
- OAuth users never saw the profile completion form
- OAuth users never saw the planet reveal animation
- The member dashboard accepted incomplete profiles

### Issue 2: Member Page Missing Profile Gate
**File**: `app/member/page.tsx`

The member dashboard page only checked authentication but didn't enforce profile completion. This meant:
- Users could access `/member` even with incomplete profiles
- Direct navigation to `/member` bypassed the profile completion flow
- The profile gate in `AuthCard` was never triggered for existing sessions

## The Fix

### 1. Added Profile Check to OAuth Callback
```typescript
// app/auth/callback/route.ts
const { data: userProfile } = await supabase
  .from('users')
  .select('profile_complete')
  .eq('id', user.id)
  .maybeSingle()

if (userProfile?.profile_complete !== true) {
  return NextResponse.redirect(`${origin}/login?returnUrl=${encodeURIComponent(next)}`)
}
```

Now OAuth sign-ins redirect incomplete profiles back to `/login`, where `AuthCard` detects the session and shows:
1. Profile completion form
2. Planet reveal animation (after profile submission)

### 2. Added Profile Gate to Member Page
```typescript
// app/member/page.tsx
const { data: profile } = await supabase
  .from("users")
  .select("profile_complete")
  .eq("id", data.user.id)
  .maybeSingle();

if (profile?.profile_complete !== true) {
  redirect("/login?returnUrl=/member");
}
```

Now the member dashboard enforces profile completion, redirecting incomplete profiles to `/login` where `AuthCard` handles the flow.

## How It Works Now

### New User Flow (Email/SMS OTP)
1. User enters email/phone → receives OTP → verifies
2. `afterSignIn()` in `AuthCard` checks `profile_complete`
3. Shows profile completion form
4. On submit → receives `memberCode` from API
5. Extracts planet from code → shows `PlanetReveal` component
6. After animation → redirects to member dashboard

### New User Flow (OAuth - Google/Apple)
1. User clicks Google/Apple sign-in → OAuth redirect
2. Returns to `/auth/callback` → creates session
3. Callback checks `profile_complete` → redirects to `/login?returnUrl=/member`
4. `AuthCard` detects existing session → checks `profile_complete`
5. Shows profile completion form
6. On submit → receives `memberCode` from API
7. Extracts planet from code → shows `PlanetReveal` component
8. After animation → redirects to member dashboard

### Existing User Flow
1. User signs in (any method)
2. `afterSignIn()` checks `profile_complete === true`
3. Immediately calls `onAuthComplete()` → redirects to destination
4. No profile form, no planet reveal (already complete)

## Testing Checklist

### New User Registration (Email OTP)
- [ ] Register with email → verify OTP
- [ ] See profile completion form
- [ ] Fill profile → submit
- [ ] See planet reveal animation with correct planet
- [ ] Animation completes → redirects to member dashboard

### New User Registration (OAuth)
- [ ] Click Google/Apple sign-in
- [ ] Complete OAuth flow
- [ ] Redirected to `/login`
- [ ] See profile completion form (NOT method picker)
- [ ] Fill profile → submit
- [ ] See planet reveal animation with correct planet
- [ ] Animation completes → redirects to member dashboard

### Existing User Login
- [ ] Sign in with existing account (any method)
- [ ] No profile form shown
- [ ] No planet reveal shown
- [ ] Direct redirect to member dashboard

### Edge Cases
- [ ] Direct navigation to `/member` with incomplete profile → redirects to `/login`
- [ ] `/login` with incomplete session → shows profile form
- [ ] `/member` with complete profile → shows dashboard

## Files Changed
- `app/auth/callback/route.ts` - Added profile_complete check after OAuth
- `app/member/page.tsx` - Added profile completion gate before dashboard

## Related Files (Unchanged, Working Correctly)
- `components/auth/AuthCard.tsx` - Profile completion flow + planet reveal
- `components/auth/ProfileCompletion.tsx` - Returns memberCode to AuthCard
- `components/member/PlanetReveal.tsx` - Planet reveal animation component
- `app/api/profile/complete/route.ts` - Generates and returns memberCode
- `lib/member/planetSystem.ts` - Planet code generation + extraction
