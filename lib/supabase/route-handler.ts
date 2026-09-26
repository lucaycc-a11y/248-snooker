import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ════════════════════════════════════════════════════════════════════════════
// Route Handler Supabase Client (CAN WRITE COOKIES)
//
// This client is used in Route Handlers (app/api/*/route.ts, app/auth/*/route.ts)
// that need to WRITE session cookies, such as OAuth callbacks and OTP verification.
//
// Why this differs from lib/supabase/server.ts:
// - server.ts is for Server Components (read-only, setAll is no-op)
// - THIS file is for Route Handlers that must write cookies (setAll actually writes)
// - OAuth callback uses exchangeCodeForSession() which MUST write cookies to persist
//   the session after redirect
//
// Usage:
//   import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
//   const supabase = await createRouteHandlerClient()
//   await supabase.auth.exchangeCodeForSession(code)  // ✅ Writes cookies
//
// ════════════════════════════════════════════════════════════════════════════

export async function createRouteHandlerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Actually write cookies in Route Handlers (unlike server.ts which is no-op)
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    },
  )
}
