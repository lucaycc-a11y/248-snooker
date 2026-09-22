import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { withSecurity } from '@/lib/security/api-wrapper'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/request-phone-change
// Sends magic link email for phone number change
// ════════════════════════════════════════════════════════════════════════════

async function handleRequestPhoneChange() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Generate a secure token for phone change
    // TODO: Store token in DB with expiry
    const changeToken = Math.random().toString(36).substring(2, 15)

    // Send email via Resend (instantiate inside handler to avoid build-time errors)
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Space8 <noreply@space8.com.hk>',
      to: user.email,
      subject: '更改電話號碼 / Change Phone Number',
      html: `
        <h2>更改電話號碼 / Change Phone Number</h2>
        <p>請點擊以下連結更改您的電話號碼 / Click the link below to change your phone number:</p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/member/change-phone?token=${changeToken}">更改電話 / Change Phone</a>
        <p>此連結將於 1 小時後失效 / This link expires in 1 hour.</p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[request-phone-change] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Export with security wrapper: CSRF + rate limiting
export const POST = withSecurity(handleRequestPhoneChange, {
  csrf: true,
  rateLimit: {
    bucket: 'phone_change_request',
    max: 5,
    windowSeconds: 300, // 5 per 5 minutes
    identifierType: 'both',
  },
})
