import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { purpose: 'password' | 'phone' }

// Generates a secure single-use token for changing password or phone number.
// Sends email to the account's email address (resolved server-side) with a link.
// Rate limited: max 3 requests per user per hour, max 3 per IP per hour.
// Invalidates all prior unused tokens for the same user + purpose.
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
    const purpose = body?.purpose

    if (!purpose || (purpose !== 'password' && purpose !== 'phone')) {
      return NextResponse.json({ error: 'invalid_purpose' }, { status: 422 })
    }

    // Rate limit: 3 per user per hour
    const userRateKey = `change_request_user:${user.id}:${purpose}`
    const userOk = await rateLimit('auth_change_request_user', userRateKey, 3, 3600)
    if (!userOk) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // Rate limit: 3 per IP per hour (prevent account enumeration)
    const ip = clientIp(request)
    const ipRateKey = `change_request_ip:${ip}`
    const ipOk = await rateLimit('auth_change_request_ip', ipRateKey, 3, 3600)
    if (!ipOk) {
      // Return same generic response to prevent enumeration
      return NextResponse.json({ ok: true, message: 'email_sent' })
    }

    // Get user's email from profile (canonical source)
    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .maybeSingle<{ email: string }>()

    const email = profile?.email || user.email

    if (!email) {
      return NextResponse.json({ error: 'no_email_on_account' }, { status: 422 })
    }

    // Generate cryptographically secure token (32 bytes = 256 bits)
    const tokenBytes = crypto.randomBytes(32)
    const token = tokenBytes.toString('base64url') // URL-safe base64
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    const service = getServiceSupabase()

    // Invalidate all prior unused tokens for this user + purpose
    await service
      .from('account_change_requests')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .is('used_at', null)

    // Create new request
    const { data: changeRequest, error: insertError } = await service
      .from('account_change_requests')
      .insert({
        user_id: user.id,
        purpose,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        request_ip: ip,
      })
      .select('id')
      .single<{ id: string }>()

    if (insertError || !changeRequest) {
      console.error('[change-request] Insert failed:', insertError)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    // Audit log
    await service.from('account_change_audit').insert({
      user_id: user.id,
      action: purpose === 'password' ? 'request_password_change' : 'request_phone_change',
      request_id: changeRequest.id,
      request_ip: ip,
    })

    // Send email with the link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk'
    const changeUrl = `${baseUrl}/auth/change-${purpose}?token=${token}`

    try {
      // Import Resend dynamically to avoid bundling issues
      const { getResend } = await import('@/lib/resend/client')
      const resend = getResend()

      await resend.emails.send({
        from: 'Space8 <noreply@space8.com.hk>',
        to: email,
        subject: purpose === 'password' ? '更改密碼確認 / Password Change Confirmation' : '更改電話號碼確認 / Phone Change Confirmation',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">Space8</h2>
            <h3>${purpose === 'password' ? '更改密碼確認 / Password Change Confirmation' : '更改電話號碼確認 / Phone Change Confirmation'}</h3>

            <p><strong>繁體中文</strong></p>
            <p>你已請求更改${purpose === 'password' ? '密碼' : '電話號碼'}。請點擊以下連結完成更改：</p>
            <p><a href="${changeUrl}" style="display: inline-block; background: #22c55e; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">確認更改</a></p>
            <p>此連結將於 30 分鐘後失效。</p>
            <p><strong>如非本人操作，請忽略此電郵並盡快更改密碼。</strong></p>

            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

            <p><strong>English</strong></p>
            <p>You have requested to change your ${purpose === 'password' ? 'password' : 'phone number'}. Click the link below to complete the change:</p>
            <p><a href="${changeUrl}" style="display: inline-block; background: #22c55e; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Confirm Change</a></p>
            <p>This link will expire in 30 minutes.</p>
            <p><strong>If this wasn't you, please ignore this email and change your password immediately.</strong></p>

            <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Space8 Snooker & Pool Club</p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('[change-request] Email send failed:', emailError)
      // Mark request as failed but don't expose email delivery issues to client
      await service
        .from('account_change_requests')
        .update({ used_at: new Date().toISOString() })
        .eq('id', changeRequest.id)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, message: 'email_sent' })
  } catch (error) {
    console.error('[change-request] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
