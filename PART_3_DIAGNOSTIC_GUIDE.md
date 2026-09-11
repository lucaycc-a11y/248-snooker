# Part 3 — Password Change Diagnostic Guide

## Issue Summary

**路徑一 (Settings Page "Save" Button)**
- Error: "未能儲存，請再試一次。"
- Button location: `/member` → Settings tab → "儲存" button

**路徑二 (Email Password Reset Link)**
- Error: "連結已過期或無效"
- Flow: Email reset link → Click → Shows expired/invalid

---

## Diagnostic Steps

### Path 1: Settings "Save" Button

**Step 1: Check actual error in browser DevTools**

1. Open `/member` → Settings tab
2. Open DevTools → Network tab
3. Change name or phone
4. Click "儲存" button
5. Find the `POST /api/profile/update` request
6. Check response:
   - Status code?
   - Response body?

**Expected causes:**

- **422 error**: Validation failed (invalid phone/name format)
- **500 error**: Database update failed (RLS policy blocking update)
- **401 error**: Session expired

**Step 2: Test with browser console**

```javascript
// Test the API directly
const response = await fetch('/api/profile/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Name' })
});
const result = await response.json();
console.log('Status:', response.status, 'Result:', result);
```

**Step 3: Check RLS policies in Supabase**

```sql
-- Check if user can update their own profile
SELECT * FROM users WHERE id = auth.uid();

-- Check RLS policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';
```

---

### Path 2: Email Password Reset Link

**Step 1: Check Supabase Redirect URL Configuration**

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Check **Redirect URLs** list
3. **Required**: `https://space8.com.hk/auth/update-password` must be in the list

**Step 2: Check email link format**

Example valid link:
```
https://space8.com.hk/auth/update-password?token_hash=pkce_XXXXX&type=recovery
```

**Step 3: Check token expiry**

- Default Supabase recovery token validity: **1 hour**
- If user clicks after 1 hour → expired

**Step 4: Test token exchange**

Open browser console on `/auth/update-password` page:

```javascript
// Check if token is present
const url = new URL(window.location.href);
console.log('Token hash:', url.searchParams.get('token_hash'));
console.log('Type:', url.searchParams.get('type'));
```

---

## Fixes

### Fix 1: Add redirect URL to Supabase (必須)

**Supabase Dashboard steps:**
1. Project → Authentication → URL Configuration
2. **Redirect URLs** section
3. Add: `https://space8.com.hk/auth/update-password`
4. Add: `http://localhost:3000/auth/update-password` (for local testing)
5. Click "Save"

### Fix 2: Improve error messages

See code changes in the actual fix commit.

---

## Testing Checklist

### Path 1: Settings Save

- [ ] Change display name only → Save → Success message shows
- [ ] Change phone only → OTP flow starts
- [ ] Change both name + phone → OTP flow starts
- [ ] Try invalid name (empty) → Proper error shows
- [ ] Try invalid phone (not 8 digits) → Proper error shows

### Path 2: Email Password Reset

- [ ] Click "Change Password" → Email sent confirmation
- [ ] Check email inbox → Received reset email
- [ ] Click link in email → Redirects to update-password page
- [ ] Enter new password → Success message shows
- [ ] Redirected to `/member` after 2 seconds
- [ ] Can log in with new password

---

## Common Issues

### Issue: "未能儲存" but no network error
**Cause**: RLS policy blocking self-update
**Fix**: Use service-role client (already implemented in code)

### Issue: Email link shows "已過期"
**Cause**: Token expired (>1 hour) OR redirect URL not whitelisted
**Fix**: Add redirect URL to Supabase + ask user to request new link

### Issue: Email link shows "無效"
**Cause**: Token already used OR redirect URL not whitelisted
**Fix**: Add redirect URL to Supabase + ensure URL is exactly `https://space8.com.hk/auth/update-password`

