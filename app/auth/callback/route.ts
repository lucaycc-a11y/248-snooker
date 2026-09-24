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

  // 詳細 logging - 記錄 OAuth callback 開始
  console.log('[auth/callback] OAuth callback START', {
    hasCode: !!code,
    codeLength: code?.length,
    origin,
    next,
    searchParams: Object.fromEntries(searchParams.entries()),
    timestamp: new Date().toISOString(),
  })

  if (!code) {
    console.error('[auth/callback] MISSING CODE', {
      url: request.url,
      allParams: Object.fromEntries(searchParams.entries()),
    })
    return NextResponse.redirect(`${origin}/login?error=missing_code&returnUrl=${encodeURIComponent(next)}`)
  }

  try {
    const supabase = await createClient()
    console.log('[auth/callback] Supabase client created, attempting exchangeCodeForSession')

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession FAILED', {
        errorMessage: error.message,
        errorName: error.name,
        errorStatus: (error as any).status,
        errorCode: (error as any).code,
        code: code.substring(0, 20) + '...',
      })
      return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
    }

    console.log('[auth/callback] exchangeCodeForSession SUCCESS')

    const { data: { user } } = await supabase.auth.getUser()
    console.log('[auth/callback] getUser result', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      provider: user?.app_metadata?.provider,
    })

    if (user) {
      const service = getServiceSupabase()

      // --- Core judgment logic: check existing onboarding status ---
      const { data: existingUser } = await service
        .from('users')
        .select('onboarding_status, profile_complete')
        .eq('id', user.id)
        .maybeSingle<{ onboarding_status: string | null; profile_complete: boolean | null }>()

      console.log('[auth/callback] Existing user check', {
        userId: user.id,
        onboardingStatus: existingUser?.onboarding_status,
        profileComplete: existingUser?.profile_complete,
      })

      // If already complete, redirect straight to the app
      if (existingUser?.onboarding_status === 'complete' || existingUser?.profile_complete === true) {
        console.log('[auth/callback] User onboarding complete, redirecting to', next)
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
          userId: user.id,
        })
      } else {
        console.log('[auth/callback] Profile upserted successfully', {
          userId: user.id,
          provider: oauthProvider,
          onboardingStatus: 'pending_second_identity',
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

        // The verified identity index is partial, so supabase-js upsert cannot
        // express its predicate. Select/update/insert avoids PostgreSQL 42P10.
        const identifier = user.email.toLowerCase()
        const verifiedAt = new Date().toISOString()
        const { data: ownIdentity, error: ownIdentityError } = await service
          .from('auth_identities')
          .select('id, verified')
          .eq('user_id', user.id)
          .eq('provider', oauthProvider)
          .eq('identifier', identifier)
          .maybeSingle<{ id: string; verified: boolean }>()

        let identityErr = ownIdentityError
        if (!identityErr && ownIdentity) {
          const { error } = await service
            .from('auth_identities')
            .update({ verified: true, verified_at: verifiedAt, updated_at: verifiedAt })
            .eq('id', ownIdentity.id)
          identityErr = error
        } else if (!identityErr) {
          const { error } = await service.from('auth_identities').insert({
            user_id: user.id,
            provider: oauthProvider,
            identifier,
            verified: true,
            verified_at: verifiedAt,
            updated_at: verifiedAt,
          })
          identityErr = error
        }

        if (identityErr && identityErr.code !== '23505') {
          console.error('[auth/callback] identity insert error', {
            message: identityErr.message,
            code: identityErr.code,
            provider: oauthProvider,
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
        console.log('[auth/callback] Final redirect to', next)
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Incomplete onboarding → redirect to /login where AuthCard handles
      // the second-identity collection flow
      console.log('[auth/callback] Incomplete onboarding, redirecting to /login', {
        userId: user.id,
        onboardingStatus: refreshedUser?.onboarding_status,
        returnUrl: next,
      })
      return NextResponse.redirect(`${origin}/login?returnUrl=${encodeURIComponent(next)}`)
    }

    console.log('[auth/callback] No user after exchangeCodeForSession, redirecting to', next)
    return NextResponse.redirect(`${origin}${next}`)
  } catch (err) {
    console.error('[auth/callback] EXCEPTION caught', {
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      errorName: err instanceof Error ? err.name : typeof err,
    })
    return NextResponse.redirect(`${origin}/login?error=oauth&returnUrl=${encodeURIComponent(next)}`)
  }
}
