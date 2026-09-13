import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/otp/send-email { email }
// Sends an email OTP for phone-first users to verify their email before profile completion.
// Similar to phone OTP, but for email verification.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[otp/send-email] not authenticated', {
        message: authError?.message,
      })
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const email = (body?.email ?? '').trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    // Rate limit: 3 email OTP requests per 5 minutes per user
    const allowed = await rateLimit('email-otp', `user:${user.id}`, 3, 300)
    if (!allowed) {
      console.warn('[otp/send-email] rate limit exceeded', {
        userId: user.id,
        email: `***@${email.split('@')[1]}`,
      })
      return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 })
    }

    // Use Supabase Auth's built-in email OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create a new user, just send OTP
      },
    })

    if (otpError) {
      console.error('[otp/send-email] OTP send failed', {
        message: otpError.message,
        email: `***@${email.split('@')[1]}`,
      })
      return NextResponse.json({ error: 'otp_send_failed' }, { status: 500 })
    }

    console.log('[otp/send-email] OTP sent', {
      userId: user.id,
      email: `***@${email.split('@')[1]}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error
    console.error('[otp/send-email] error', { message: e.message })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
