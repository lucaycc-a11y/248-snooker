# Email Validation Bug Root Cause Analysis

## The Bug
User reports: "Email validation rejects every email in booking flow profile completion step"

## Root Cause Found

### AuthCard.tsx lines 148, 210:
```typescript
setVerifiedEmail(idEmail ?? data?.email ?? user.email ?? undefined)
```

### The Problem:
If any of these sources returns **empty string `""`** instead of `null/undefined`, then:
- `verifiedEmail` state becomes `""` (truthy value)
- ProfileCompletion receives `verifiedEmail=""`

### ProfileCompletion.tsx line 126:
```typescript
const showEmail = missingContact !== "phone" && !verifiedEmail
```

When `verifiedEmail = ""`:
- `!verifiedEmail` evaluates to `false` (because `!"" === false`)
- Therefore `showEmail = false`
- The email input field is HIDDEN

### ProfileCompletion.tsx line 129:
```typescript
const effectiveEmail = showEmail ? email : (verifiedEmail ?? initialEmail)
```

When `showEmail = false` and `verifiedEmail = ""`:
- `effectiveEmail = ""` (the empty verifiedEmail value)
- User's typed email is IGNORED

### Result:
Validation always fails with `email_invalid` because it validates an empty string instead of the user's typed email.

## Reproduction Scenario

**SMS user completes profile:**
1. User signs in via SMS → has verified phone, needs email
2. AuthCard sets `missingContact = "email"`
3. Supabase returns `user.email = ""` (empty string, not null)
4. AuthCard calls `setVerifiedEmail("")`
5. ProfileCompletion receives `verifiedEmail=""`
6. `showEmail = false` (should be true!)
7. Email input is HIDDEN (should be visible!)
8. Even if shown via bug, validation uses `effectiveEmail = ""` (wrong!)

## The Fix

**Option 1: Normalize empty strings to undefined in AuthCard**
```typescript
// Line 148, 210
const normalizedEmail = idEmail ?? data?.email ?? user.email ?? undefined
setVerifiedEmail(normalizedEmail || undefined) // Convert "" to undefined
```

**Option 2: Fix the showEmail condition in ProfileCompletion**
```typescript
// Line 126
const showEmail = missingContact !== "phone" && (!verifiedEmail || verifiedEmail === "")
```

**Option 3: Fix effectiveEmail to ignore empty strings**
```typescript
// Line 129
const effectiveEmail = showEmail ? email : (verifiedEmail && verifiedEmail !== "" ? verifiedEmail : initialEmail)
```

**Recommended: Option 1** — normalize at the source (AuthCard) so empty strings never reach ProfileCompletion.
