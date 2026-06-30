import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// SERVER-ONLY service-role client for privileged writes that must bypass RLS:
// the Stripe webhook (booking confirmation, queue inserts) and the rate-limit
// RPC. The service-role key grants full DB access — NEVER import this into a
// Client Component, and never return its data unfiltered to a browser.
//
// Throws (rather than returning null) when the key is missing, so a misconfigured
// deployment fails loudly at first use instead of silently skipping security.
let cached: SupabaseClient | null = null

export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Service Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
