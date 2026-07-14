import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cookieless, anon-key client for reading PUBLIC data (config, blog_posts,
// cms_content) in Server Components. Unlike lib/supabase/server.ts it does not
// touch cookies, so pages that only read public data stay statically render-able
// and cacheable. Never use this for anything user-scoped or for writes.
//
// Returns null when env vars are absent (e.g. local dev without Supabase),
// letting callers fall back to bundled defaults instead of throwing.
let cached: SupabaseClient | null | undefined

export function getPublicSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  cached = url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

  return cached
}
