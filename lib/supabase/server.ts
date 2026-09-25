import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ════════════════════════════════════════════════════════════════════════════
// Server Component Supabase Client (READ-ONLY)
//
// This client is used in Server Components (pages, layouts) and ONLY reads cookies.
// Cookie writes are handled by middleware (lib/supabase/middleware.ts updateSession).
//
// Why setAll is a no-op:
// - Next.js throws "Cookies can only be modified in a Server Action or Route Handler"
//   if a Server Component tries to write cookies via cookies().set()
// - The middleware already refreshed the session and wrote fresh cookies before
//   this page/layout renders (via updateSession in middleware.ts:15-88)
// - Making setAll a safe no-op prevents the "stuck on auto-login" bug where
//   Supabase tries to write refreshed cookies during render and throws, killing
//   the session persistence
//
// This follows the documented @supabase/ssr pattern for Next.js App Router:
// https://supabase.com/docs/guides/auth/server-side/nextjs
// ════════════════════════════════════════════════════════════════════════════

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // No-op in Server Components — middleware already wrote refreshed cookies.
          // Attempting to write here throws "Cookies can only be modified in a
          // Server Action or Route Handler" and breaks session persistence.
        },
      },
    },
  )
}
