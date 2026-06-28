import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Never cache the OAuth callback — the PKCE code is one-time use.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/book'

  if (!code) {
    return NextResponse.redirect(`${origin}/book?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Swallow set errors in middleware context where cookies are read-only.
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth callback error:', error.message)
    return NextResponse.redirect(`${origin}/book?error=${encodeURIComponent(error.message)}`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name ?? '',
        avatar_url: user.user_metadata?.avatar_url ?? '',
        points: 50,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
