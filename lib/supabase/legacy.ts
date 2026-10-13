// LEGACY-UNTYPED: schema drift. Remove an import when the table/column exists or the feature is deleted.
//
// This file provides untyped Supabase clients for code that queries tables or columns
// not present in database.types.ts. These are mostly admin/pilot/AI features built
// against a phantom schema. The member area uses typed clients (service.ts,
// route-handler.ts, server.ts). New code should use typed clients; this is a
// containment strategy for existing drift.
//
// DO NOT import this into new code. DO NOT copy its pattern. Fix the schema or delete
// the feature.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Untyped service-role client (bypasses RLS, no type checking)
let cachedService: SupabaseClient | null = null

export function getLegacyServiceSupabase(): SupabaseClient {
  if (cachedService) return cachedService

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Service Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  cachedService = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedService
}

// Untyped route-handler client (can write cookies, no type checking)
export async function getLegacyRouteHandlerClient(): Promise<SupabaseClient> {
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
