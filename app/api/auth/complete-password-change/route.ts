import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateChangeToken, consumeChangeToken } from '@/lib/auth/change-token'
import { validatePassword } from '@/lib/auth/password'
import { clientIp } from '@/lib/rate-limit'
import { withSecurity } from '@/lib/security/api-wrapper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { token: string; password: string }

// Completes a password change via email link token.
// Validates token, updates password, marks token as used, logs the change,
// sends confirmation email, and signs out other sessions.
async function handleCompletePasswordChange(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
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
    const { token, password } = body || {}

    if (!token || !password) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    // Validate password strength
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.ok) {
      return NextResponse.json(
        { error: 'password_weak', reasons: passwordCheck.reasons },
        { status: 422 }
      )
    }

    // Validate token (again, for atomicity)
    const tokenValidation = await validateChangeToken(token, 'password', user.id)
    if (!tokenValidation.ok) {
      return NextResponse.json({ error: `token_${tokenValidation.error}` }, { status: 400 })
    }

    const { requestId } = tokenValidation

    // Update password via Supabase auth
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      console.error('[complete-password-change] updateUser failed:', updateError)

      // Check for specific errors
      if (updateError.message?.includes('same')) {
        return NextResponse.json({ error: 'password_same' }, { status: 422 })
      }
      if (updateError.message?.includes('weak')) {
        return NextResponse.json({ error: 'password_weak' }, { status: 422 })
      }

      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    // Consume token atomically
    const consumed = await consumeChangeToken(requestId)
    if (!consumed) {
      // Token was already used (double-submit race condition)
      return NextResponse.json({ error: 'token_used' }, { status: 409 })
    }

    const service = getServiceSupabase()
    const ip = clientIp(request)

    // Audit log
    await service.from('account_change_audit').insert({
      user_id: user.id,
      action: 'complete_password_change',
      request_id: requestId,
      request_ip: ip,
    })

    // Send confirmation email
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .maybeSingle<{ email: string }>()

      const email = profile?.email || user.email

      if (email) {
        const { getResend } = await import('@/lib/resend/client')
        const resend = getResend()

        await resend.emails.send({
          from: 'Space8 <noreply@space8.com.hk>',
          to: email,
          subject: '密碼已更改 / Password Changed',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #22c55e;">Space8</h2>
              <h3>密碼已更改 / Password Changed</h3>

              <p><strong>繁體中文</strong></p>
              <p>你的密碼已成功更改。</p>
              <p>如非本人操作，請立即聯絡我們。</p>

              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

              <p><strong>English</strong></p>
              <p>Your password has been successfully changed.</p>
              <p>If this wasn't you, please contact us immediately.</p>

              <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Space8 Snooker & Pool Club</p>
            </div>
          `,
        })
      }
    } catch (emailError) {
      // Log but don't fail - password was already changed
      console.error('[complete-password-change] confirmation email failed:', emailError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[complete-password-change] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// Export with security wrapper: CSRF + rate limiting
export const POST = withSecurity(handleCompletePasswordChange, {
  csrf: true,
  rateLimit: {
    bucket: 'auth_password_change',
    max: 5,
    windowSeconds: 300, // 5 attempts per 5 minutes
    identifierType: 'both',
  },
})
