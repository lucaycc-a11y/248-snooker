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
  //
  // getUser() talks to the Auth server over the network — it can throw on a
  // transient outage, a network timeout, or when a concurrent request already
  // spent the single-use refresh token. If it throws here, letting it bubble up
  // turns every /api/* call into a 500 *before* the route handler ever runs
  // (e.g. /api/otp/verify-binding wrote zero rows because its handler never ran).
  //
  // Swallowing this is safe: it only skips the session *refresh*, not
  // authentication itself. The route handler (e.g. route.ts L17) re-runs its own
  // getUser() with the cookies carried on the request and will 401 there if the
  // user is genuinely signed out. We just must not let a refresh hiccup nuke the
  // whole request.
  try {
    await supabase.auth.getUser()
  } catch (err) {
    // Prefix `[supabase/middleware]` distinguishes this from route-handler errors
    // (`[otp/verify-binding]`), so the next 500 can be traced to the right layer
    // at a glance instead of re-deriving it from scratch.
    console.error('[supabase/middleware] getUser failed, continuing without session refresh', err)
  }

  // IMPORTANT: return supabaseResponse as-is — its cookies carry the refreshed
  // session. If a caller needs a different response, it must copy these cookies
  // over or session persistence silently breaks.
  return supabaseResponse
}
