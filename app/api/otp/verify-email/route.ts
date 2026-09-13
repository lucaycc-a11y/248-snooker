import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/otp/verify-email { email, token }
// Verifies the email OTP and updates auth.users.email for phone-first users.
// After this succeeds, the user can submit profile completion with the verified email.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[otp/verify-email] not authenticated', {
        message: authError?.message,
      })
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const email = (body?.email ?? '').trim().toLowerCase()
    const token = (body?.token ?? '').trim()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
    }

    // Verify the OTP using Supabase Auth
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (verifyError) {
      console.warn('[otp/verify-email] verification failed', {
        message: verifyError.message,
        email: `***@${email.split('@')[1]}`,
        userId: user.id,
      })
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 })
    }

    if (!verifyData.user) {
      console.error('[otp/verify-email] verification returned no user', {
        email: `***@${email.split('@')[1]}`,
        userId: user.id,
      })
      return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
    }

    // Update auth.users.email using admin API (service role)
    const service = getServiceSupabase()
    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true, // Mark email as confirmed
    })

    if (updateError) {
      console.error('[otp/verify-email] failed to update user email', {
        message: updateError.message,
        email: `***@${email.split('@')[1]}`,
        userId: user.id,
      })
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    // Create email identity in auth_identities
    const now = new Date().toISOString()
    const { error: identityError } = await service.from('auth_identities').insert({
      user_id: user.id,
      provider: 'email',
      identifier: email,
      verified: true,
      verified_at: now,
      created_at: now,
      updated_at: now,
    })

    if (identityError) {
      // Log but don't fail — the email update already succeeded
      console.warn('[otp/verify-email] failed to create email identity', {
        message: identityError.message,
        code: identityError.code,
        email: `***@${email.split('@')[1]}`,
        userId: user.id,
      })
    }

    console.log('[otp/verify-email] success', {
      userId: user.id,
      email: `***@${email.split('@')[1]}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error
    console.error('[otp/verify-email] error', { message: e.message })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
