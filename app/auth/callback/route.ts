import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null): string {
  if (!value) return '/member'
  if (!value.startsWith('/')) return '/member'
  if (value.startsWith('//')) return '/member'
  return value
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next') ?? searchParams.get('returnUrl'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code&returnUrl=${encodeURIComponent(next)}`)
  }

  try {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const profile = {
        id: user.id,
        email: user.email ?? null,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          (user.email ? user.email.split('@')[0] : null),
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      }

      await supabase.from('users').upsert(profile, { onConflict: 'id' })
    }

    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
  }
}
