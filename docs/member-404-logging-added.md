# /member 404 Logging Implementation

**Date**: 2026-09-24  
**Branch**: `fix/member-404-with-logging`

## Changes Made

### Step 1: Added Comprehensive Logging

Added detailed logging to track the `/member` 404 issue at every possible failure point:

#### 1. Member Page ([app/member/page.tsx](app/member/page.tsx))

**Added logging for**:
- Data fetch exceptions → logs to `site_error_log` with source `member-page-data-fetch-error`
- Unauthenticated users → logs with source `member-page-no-data` (severity: info)
- Successful renders → logs with source `member-page-success` (severity: info)

**What's logged**:
- Error messages and stack traces
- Request pathname and user agent
- User ID, tier, and points (on success)

#### 2. Data Fetching Layer ([lib/data/getMemberRedesign.ts](lib/data/getMemberRedesign.ts))

**Added logging for**:
- Auth errors from `supabase.auth.getUser()` → source `member-data-auth-error`
- Unauthenticated users → source `member-data-no-user` (severity: info)
- Auth exceptions → source `member-data-auth-exception`
- Profile fetch errors → source `member-data-profile-error` (severity: warning)

**What's logged**:
- Supabase auth error details (message, name, status)
- User ID when available
- Error stack traces for exceptions

### Logging Pattern Used

All logging uses the existing `logSiteError()` function from [lib/errors/log.ts](lib/errors/log.ts):

```typescript
await logSiteError(
  source: string,         // Unique identifier for this log point
  severity: 'error' | 'warning' | 'info',
  message: string,        // Human-readable description
  detail?: object         // Additional structured data
)
```

Logs are persisted to `public.site_error_log` table with schema:
- `source` - identifies where the log came from
- `severity` - error/warning/info
- `message` - description
- `detail` - JSON object with additional context
- `created_at` - timestamp

## Testing Instructions

### To Reproduce the 404 Issue

1. **Deploy this branch** to UAT or a preview environment
2. **Create a test account** via phone OTP (confirmed working in prompt)
3. **Navigate to** `https://space8.com.hk/member` after successful login
4. **If 404 appears**, the logs will capture the exact failure point

### To Read the Logs

Query the database after reproduction:

```sql
-- Get all member-related logs from the last hour
SELECT 
  created_at,
  source,
  severity,
  message,
  detail
FROM site_error_log
WHERE source LIKE 'member-%'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Get the most recent member page access
SELECT 
  created_at,
  source,
  message,
  detail
FROM site_error_log
WHERE source IN (
  'member-page-data-fetch-error',
  'member-page-no-data',
  'member-page-success',
  'member-data-auth-error',
  'member-data-no-user',
  'member-data-auth-exception',
  'member-data-profile-error'
)
ORDER BY created_at DESC
LIMIT 10;
```

### Expected Log Entries

**For successful authenticated access**:
```
source: member-page-success
severity: info
message: Member page rendered successfully
detail: { user_id: "...", tier: "amateur", points: 0 }
```

**For unauthenticated access** (shows login prompt):
```
source: member-data-no-user
severity: info
message: getMemberDashboardData called without authenticated user
detail: { auth_error: null, note: "This returns null..." }
```

**For the actual 404 bug**, one of these will appear:
```
source: member-page-data-fetch-error
severity: error
message: getMemberDashboardData threw an exception
detail: { error_message: "...", error_stack: "...", pathname: "/member", ... }
```

OR

```
source: member-data-auth-exception
severity: error  
message: Exception thrown during supabase.auth.getUser()
detail: { error_message: "...", error_stack: "..." }
```

## What This Reveals

The logs will tell us **exactly** which code path is causing the 404:

1. **If `member-page-data-fetch-error` appears** → Exception thrown in `getMemberDashboardData()`
2. **If `member-data-auth-exception` appears** → Supabase auth layer failing
3. **If `member-data-auth-error` appears** → Supabase returning an error (not throwing)
4. **If only `member-page-no-data` appears** → Auth succeeding but returning no user (session issue)
5. **If no logs appear at all** → Route not being reached (middleware redirect or 404 before page loads)

## Next Steps After Logging

Once we have the real log entry:

1. **Identify root cause** from the logged error message and stack trace
2. **Check for related issues**:
   - Locale prefix problems (`/zh-HK/member` vs `/member`)
   - Middleware redirect loops
   - Session/cookie issues specific to OTP login
   - Missing profile data causing exceptions
3. **Fix the confirmed cause** with targeted changes
4. **Keep the logging in place** for future debugging

## Build Status

✅ `npm run build` passed  
✅ No TypeScript errors  
✅ `/member` route compiles successfully (11.3 kB, server-rendered)

## Files Modified

- [app/member/page.tsx](app/member/page.tsx) — Added error handling and logging
- [lib/data/getMemberRedesign.ts](lib/data/getMemberRedesign.ts) — Added auth and data fetch logging
