import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase SSR session refresh — the single place a request's session is renewed.
//
// WHY THIS EXISTS: getUser() revalidates the access token with the Auth server and,
// when it's expiring, spends the *single-use* refresh token to mint a new pair
// (the refresh token is ROTATED). If several server entrypoints (an RSC, a data
// loader, and an API route) each call getUser() concurrently for the same request,
// they race on that one-time rotation — the losers present an already-rotated token
// and get back a null session, i.e. an intermittent 401.
//
// Running the refresh ONCE here, before any handler, means downstream getUser()
// calls always see a fresh token and never initiate a competing rotation.
export async function updateSession(request: NextRequest) {
  // Carries the request through unchanged unless we need to write refreshed cookies.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write refreshed cookies onto BOTH the request (so handlers/RSCs in this
          // same pass read the new token) and a fresh response (so the browser
          // persists it). Rebuilding the response here is required by @supabase/ssr.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do NOT put logic between createServerClient and getUser(). getUser()
  // is what triggers the token refresh + rotation exactly once for this request.
  await supabase.auth.getUser()

  // IMPORTANT: return supabaseResponse as-is — its cookies carry the refreshed
  // session. If a caller needs a different response, it must copy these cookies
  // over or session persistence silently breaks.
  return supabaseResponse
}
