import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateChangeToken } from '@/lib/auth/change-token'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { token: string; newPhone: string }

// Sends OTP to the new phone number for verification.
// Validates: token is valid, new phone is in E.164 format, new phone is not
// already in use by another account, rate limits are respected.
// Returns messageId for subsequent OTP verification.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // Read-only
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null
    const { token, newPhone } = body || {}

    if (!token || !newPhone) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const normalized = normalizeHkPhone(newPhone)
    if (!normalized) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 422 })
    }

    // Validate token
    const tokenValidation = await validateChangeToken(token, 'phone', user.id)
    if (!tokenValidation.ok) {
      return NextResponse.json({ error: `token_${tokenValidation.error}` }, { status: 400 })
    }

    // Rate limit: 5 OTP sends per user per hour
    const userRateKey = `phone_change_otp_user:${user.id}`
    const userOk = await rateLimit('phone_change_otp_user', userRateKey, 5, 3600)
    if (!userOk) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // Rate limit: 5 OTP sends per phone per hour (prevent harassment)
    const phoneRateKey = `phone_change_otp_phone:${normalized}`
    const phoneOk = await rateLimit('phone_change_otp_phone', phoneRateKey, 5, 3600)
    if (!phoneOk) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // Check if phone is already in use by another account
    const service = getServiceSupabase()

    // Check auth_identities first
    const { data: identityOwner } = await service
      .from('auth_identities')
      .select('user_id')
      .eq('provider', 'phone')
      .eq('identifier', normalized)
      .eq('verified', true)
      .maybeSingle<{ user_id: string }>()

    if (identityOwner && identityOwner.user_id !== user.id) {
      return NextResponse.json({ error: 'phone_in_use' }, { status: 409 })
    }

    // Also check public.users.phone
    const { data: phoneOwner } = await service
      .from('users')
      .select('id')
      .eq('phone', normalized)
      .neq('id', user.id)
      .maybeSingle<{ id: string }>()

    if (phoneOwner) {
      return NextResponse.json({ error: 'phone_in_use' }, { status: 409 })
    }

    // Send OTP via Supabase
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        shouldCreateUser: false, // Don't create a new user
      },
    })

    if (otpError) {
      console.error('[send-phone-change-otp] signInWithOtp failed:', otpError)
      return NextResponse.json({ error: 'otp_send_failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      messageId: otpData?.messageId || '',
    })
  } catch (error) {
    console.error('[send-phone-change-otp] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
