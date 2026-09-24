# OAuth Login Failure + /member 404 Investigation

## Part H — Google OAuth Login Failure

### Root Cause Hypothesis (HIGH CONFIDENCE)

**The OAuth callback URL varies by domain, but Google's OAuth client has a fixed authorized redirect URI list.**

### Evidence

1. **Code Analysis** — [GoogleSignInButton.tsx:112-119](components/auth/GoogleSignInButton.tsx#L112-L119):
   ```typescript
   const origin = typeof window !== "undefined" ? window.location.origin : SITE_URL
   const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
   await supabase.auth.signInWithOAuth({
     provider: "google",
     options: { redirectTo },
   })
   ```

2. **Dynamic callback URLs** — The app generates different callback URLs based on user's domain:
   - `https://space8.com.hk/auth/callback`
   - `https://248.formhk.com/auth/callback` (if this domain exists)
   - `https://*.vercel.app/auth/callback` (preview deployments)

3. **Error symptom matches redirect URI mismatch**:
   - Error shows on Google's own UI ("發生問題 - 很抱歉，出了點小狀況，請再試一次")
   - Failure happens BEFORE Supabase callback (no entries in `site_error_log` or `auth.audit_log_entries`)
   - This is classic OAuth redirect URI mismatch behavior

4. **Supabase OAuth flow**:
   - User clicks sign in → App calls Supabase → Supabase redirects to Google
   - Google OAuth checks: is `redirect_uri` in authorized list?
   - If NO → Generic error (what user sees)
   - If YES → Google calls back to Supabase → Supabase calls app's `/auth/callback`

### What to Check in Google Cloud Console

**Location**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client IDs

**Find the OAuth client** configured in Supabase:
- Client ID matches: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var (if using GIS)
- OR the one configured in Supabase Dashboard → Authentication → Providers → Google

**Check "Authorized redirect URIs"** section — it MUST contain:
```
https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback
```

**AND potentially these app redirect URIs (if configured for post-OAuth redirect)**:
```
https://space8.com.hk/auth/callback
https://248.formhk.com/auth/callback
https://*.vercel.app/auth/callback  (if testing preview deployments)
```

### Most Likely Issues

**Issue 1: Missing Supabase callback URL**
- If `https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback` is NOT in the list
- FIX: Add it to authorized redirect URIs

**Issue 2: OAuth consent screen in Testing mode with restricted users**
- Location: Google Cloud Console → OAuth consent screen
- If status = "Testing" and user's Google account NOT in test users list
- FIX: Add user to test users OR publish the app (move to Production)

**Issue 3: Client Secret rotated/mismatched**
- Check Supabase Dashboard → Authentication → Providers → Google
- Client ID and Client Secret must match the Google Cloud Console OAuth client
- FIX: Copy correct Client Secret from Google Console to Supabase

### Verification Steps

1. **Access Google Cloud Console**:
   ```
   https://console.cloud.google.com/
   → Select the project used for Space8
   → APIs & Services → Credentials
   ```

2. **Find the OAuth 2.0 Client ID** (the one Supabase uses)

3. **Check Authorized redirect URIs** — compare against:
   - Required: `https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback`
   - The actual domain where OAuth failed

4. **Check OAuth consent screen**:
   ```
   APIs & Services → OAuth consent screen
   → Check Publishing status and Test users (if in Testing mode)
   ```

5. **Test on each environment**:
   - Production (space8.com.hk)
   - UAT (uat branch deployment)
   - Preview URL where the error occurred

### Fix (once root cause confirmed)

**If redirect URI missing**:
```
Google Cloud Console → OAuth client → Authorized redirect URIs
→ Add: https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback
→ Save
```

**If consent screen restricted**:
```
OAuth consent screen → Add test users
OR → Publish app (move to Production)
```

**If client secret wrong**:
```
Copy from: Google Cloud Console → OAuth client → Client secret
Paste to: Supabase Dashboard → Authentication → Providers → Google
```

---

## Part I — /member 404 Investigation

### Current Status

Need to verify if `/member` route exists and is properly configured.

### Code Check

Using graphify to search for member route:

<function_calls>
<invoke name="Bash">
<parameter name="command">graphify query "member route page component"