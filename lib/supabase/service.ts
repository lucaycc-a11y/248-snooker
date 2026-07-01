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

  // One-time sanity check: SUPABASE_SERVICE_ROLE_KEY is a JWT whose payload
  // carries `role`. Decoding the payload is safe (it's not the signature —
  // Supabase's own client-side libraries read this same field), and this log
  // line is the fastest way to prove whether Vercel actually has the
  // service-role key set, vs. the anon key pasted into the wrong env var, vs.
  // a since-rotated key — all three produce the exact same 42501 "permission
  // denied" symptom from Postgres with no other distinguishing signal.
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'))
    if (payload.role !== 'service_role') {
      console.error('[supabase/service] SUPABASE_SERVICE_ROLE_KEY has wrong role claim', {
        actualRole: payload.role,
      })
    }
  } catch {
    console.error('[supabase/service] SUPABASE_SERVICE_ROLE_KEY is not a valid JWT')
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
