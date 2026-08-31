import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'

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
      const service = getServiceSupabase()

      // --- Core judgment logic: check existing onboarding status ---
      const { data: existingUser } = await service
        .from('users')
        .select('onboarding_status, profile_complete')
        .eq('id', user.id)
        .maybeSingle<{ onboarding_status: string | null; profile_complete: boolean | null }>()

      // If already complete, redirect straight to the app
      if (existingUser?.onboarding_status === 'complete' || existingUser?.profile_complete === true) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // --- Upsert profile row with onboarding_status ---
      const oauthProvider = (user.app_metadata?.provider as string) ?? 'unknown'
      const profile = {
        id: user.id,
        email: user.email ?? null,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          (user.email ? user.email.split('@')[0] : null),
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        onboarding_status: 'pending_second_identity' as const,
      }

      const { error: upsertErr } = await service.from('users').upsert(profile, { onConflict: 'id' })
      if (upsertErr) {
        console.error('[auth/callback] profile upsert error', {
          message: upsertErr.message,
          code: (upsertErr as { code?: string }).code,
          provider: oauthProvider,
        })
      }

      // --- Record OAuth identity in auth_identities ---
      if (user.email) {
        // Check for cross-provider email merge: does another user already have
        // a verified identity with this email?
        const { data: existingIdentity } = await service
          .from('auth_identities')
          .select('user_id')
          .eq('identifier', user.email.toLowerCase())
          .eq('verified', true)
          .neq('user_id', user.id)
          .maybeSingle()

        if (existingIdentity) {
          // Cross-provider email merge: the OAuth email matches an existing
          // account. Log for now — a full merge (consolidating profiles,
          // bookings, etc.) should be handled by a dedicated merge endpoint.
          console.warn('[auth/callback] cross-provider email merge detected', {
            oauthUserId: user.id,
            existingUserId: existingIdentity.user_id,
            email: user.email,
            provider: oauthProvider,
          })
        }

        // Insert OAuth identity (provider = google/apple/etc.)
        const { error: identityErr } = await service
          .from('auth_identities')
          .upsert(
            {
              user_id: user.id,
              provider: oauthProvider,
              identifier: user.email.toLowerCase(),
              verified: true,
              verified_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,provider,identifier' },
          )

        if (identityErr && identityErr.code !== '23505') {
          // 23505 = unique constraint violation (race condition, safe to ignore)
          console.error('[auth/callback] identity insert error', {
            message: identityErr.message,
            code: identityErr.code,
          })
        }
      }

      // --- Redirect based on onboarding status ---
      // Re-fetch after upsert to get the canonical status
      const { data: refreshedUser } = await service
        .from('users')
        .select('onboarding_status')
        .eq('id', user.id)
        .maybeSingle<{ onboarding_status: string | null }>()

      if (refreshedUser?.onboarding_status === 'complete') {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Incomplete onboarding → redirect to /login where AuthCard handles
      // the second-identity collection flow
      return NextResponse.redirect(`${origin}/login?returnUrl=${encodeURIComponent(next)}`)
    }

    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
  }
}
