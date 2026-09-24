# OAuth + /member Investigation

## Evidence Gathered

### Code Review Findings

**OAuth Redirect URL Construction** ([GoogleSignInButton.tsx:112-119](components/auth/GoogleSignInButton.tsx#L112-L119)):
```typescript
const origin = typeof window !== "undefined" ? window.location.origin : SITE_URL
const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo },
})
```

**Problem**: The app builds the callback URL from `window.location.origin`, so the URL varies by domain:
- `https://space8.com.hk/auth/callback`
- `https://248.formhk.com/auth/callback`
- `https://*.vercel.app/auth/callback` (preview URLs)

**Root cause hypothesis**: Google's OAuth client has a fixed authorized redirect URI list. If the user accesses from a domain NOT in that list, Google rejects the OAuth request with a generic error **before** ever calling back to the app — which explains:
1. Why the error shows Google's own error UI (not Space8's)
2. Why there are ZERO entries in `site_error_log` or `auth.audit_log_entries` — the request never reaches Supabase

### Supabase Configuration
- Project: wqmciwieiqvnswvspdyz
- OAuth callback URL (Supabase generates): `https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback`
- The app's callback: `https://<domain>/auth/callback`

The flow is: User clicks → Google → Supabase OAuth → App callback

### Environment Variables
- `NEXT_PUBLIC_SITE_URL=""` (empty in .env.local)
- `NEXT_PUBLIC_SUPABASE_URL=https://wqmciwieiqvnswvspdyz.supabase.co`

## Part H Verification Results

### Production Domain Status
- ✅ `space8.com.hk` is live (redirects to `/coming-soon` - site gate active)
- ✅ `/member` returns HTTP 200 (route exists and works)

### Google OAuth - ACTION REQUIRED

**You must perform these steps** (requires Google Cloud Console access):

1. **Access Google Cloud Console**
   ```
   https://console.cloud.google.com/
   → Select Space8 project
   → APIs & Services → Credentials
   ```

2. **Find the OAuth 2.0 Client ID**
   - Check which Client ID is configured in Supabase Dashboard
   - Path: Supabase → Authentication → Providers → Google → Client ID

3. **Verify "Authorized redirect URIs"** section contains:
   ```
   https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback
   ```
   **If missing**: Click "Add URI", paste the URL above, click "Save"

4. **Check OAuth consent screen** (APIs & Services → OAuth consent screen):
   - If "Publishing status" = "Testing":
     - EITHER: Add the failing user's Google account to "Test users"
     - OR: Click "Publish App" to move to Production
   - If "Status" = "Suspended": Contact Google to resolve

5. **Verify Client Secret** matches:
   - Google Cloud Console → OAuth client → Client secret
   - Supabase Dashboard → Authentication → Providers → Google → Client secret
   - If mismatched: Copy from Google Console, paste to Supabase, save

6. **Test after fixing**:
   - Visit production site
   - Click Google sign-in
   - Should redirect to Google → back to Supabase → back to app (no error)

---

## Part I Verification Results

### /member 404 Status: ✅ RESOLVED (Already Fixed)

**Verified**:
```bash
$ curl -sI https://space8.com.hk/member
HTTP/2 200 ✅
```

**Evidence**:
- Route exists: `app/member/page.tsx` ✅
- Middleware configured: `/member` in `BYPASS_PREFIXES` (line 16) ✅
- Recent fix: commit `5a01bdf` (Sep 23, 2026) "fix(member): allow OAuth users to access /member without password" ✅

**Root cause of original 404** (now fixed):
- Password gate was blocking OAuth users who hadn't set a password
- Fix added OAuth identity check (middleware.ts:206-208)
- OAuth users (Google/Apple) now bypass password requirement

**If still experiencing 404**:
1. Clear browser cache and cookies
2. Verify URL is exactly `https://space8.com.hk/member` (no locale prefix)
3. Check if testing on a different environment (preview URL vs production)
4. Try incognito/private browsing mode
