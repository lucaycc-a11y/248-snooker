# Part B1 — client-side checks (throwaway account only)

Sign in to space8.com.hk as the **throwaway** test account, open DevTools → Console:

```js
const { createBrowserClient } = await import('https://esm.sh/@supabase/ssr@0.5.2')
const sb = createBrowserClient('<NEXT_PUBLIC_SUPABASE_URL>', '<NEXT_PUBLIC_SUPABASE_ANON_KEY>')
const { data: { user } } = await sb.auth.getUser(); console.log(user.id)

// 1. Each must return an error (identity_change_forbidden / permission denied)
console.log(await sb.auth.updateUser({ phone: '+85290000004' }))
console.log(await sb.auth.updateUser({ email: 'b1-blocked@example.com' }))
console.log(await sb.from('users').update({ phone: '+85290000004' }).eq('id', user.id).select())
console.log(await sb.from('users').update({ email: 'b1-blocked@example.com' }).eq('id', user.id).select())

// 2. Must still work (allowed column)
console.log(await sb.from('users').update({ display_name: 'B1 Test' }).eq('id', user.id).select())
```

Expected: the four calls in step 1 return `error`, and step 2 returns the updated row.

## Still-allowed flows (manual)
- New Google sign-up → onboarding adds phone (null → value) → SMS code → profile completes.
- Existing member SMS login.
- Existing member Google sign-in.

## 3. Success path (signed in as admin, admin app console)
```js
await fetch('/api/admin/identity-change', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: '<test uuid>', new_phone: '+8529xxxxxxx', reason: 'B1 verification' }) }).then(r => r.json())
```
Paste the response (contains Resend ids in `emails[].id`). Then the test tab from step 1 should be signed out at the next refresh (≤1h for the access token).
