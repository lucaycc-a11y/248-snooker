import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()
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

      const { error: upsertErr } = await supabase.from('users').upsert(profile, { onConflict: 'id' })
      if (upsertErr) {
        // Don't block sign-in (the assign_member_code trigger / RLS path already
        // works for Google), but log so an Apple-specific post-exchange failure is
        // diagnosable instead of a silent redirect. The session is valid either way.
        console.error('callback_profile_upsert_error', {
          message: upsertErr.message,
          code: (upsertErr as { code?: string }).code,
          provider: user.app_metadata?.provider ?? null,
        })
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
  }
}
