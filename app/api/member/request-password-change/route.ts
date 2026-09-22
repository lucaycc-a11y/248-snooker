import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { withSecurity } from '@/lib/security/api-wrapper'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/request-password-change
// Sends magic link email for password change
// ════════════════════════════════════════════════════════════════════════════

async function handleRequestPasswordChange() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Generate password reset link via Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    })

    if (error) throw error

    // Send email via Resend (instantiate inside handler to avoid build-time errors)
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Space8 <noreply@space8.com.hk>',
      to: user.email,
      subject: '更改密碼 / Change Password',
      html: `
        <h2>更改密碼 / Change Password</h2>
        <p>請點擊以下連結更改您的密碼 / Click the link below to change your password:</p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password">更改密碼 / Change Password</a>
        <p>此連結將於 1 小時後失效 / This link expires in 1 hour.</p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[request-password-change] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Export with security wrapper: CSRF + rate limiting
export const POST = withSecurity(handleRequestPasswordChange, {
  csrf: true,
  rateLimit: {
    bucket: 'password_change_request',
    max: 5,
    windowSeconds: 300, // 5 per 5 minutes
    identifierType: 'both',
  },
})
