import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { isVerificationCodeValid } from '@/lib/auth/verification'
import { verifyEngagelabOtp } from '@/lib/engagelab/otp'

type Body = { requestId?: unknown; code?: unknown }
type RequestRow = {
  id: string
  user_id: string
  kind: 'email' | 'phone'
  new_value: string
  new_message_id: string | null
  new_code_hash: string | null
  new_code_expires_at: string | null
  status: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as Body | null
    const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!requestId || !code) return NextResponse.json({ error: 'invalid_input' }, { status: 422 })

    const service = getServiceSupabase()
    const { data: change, error } = await service
      .from('contact_change_requests')
      .select('id, user_id, kind, new_value, new_message_id, new_code_hash, new_code_expires_at, status')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'awaiting_new')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<RequestRow>()
    if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!change) return NextResponse.json({ error: 'change_expired' }, { status: 410 })

    const valid = change.kind === 'phone'
      ? Boolean(change.new_message_id && (await verifyEngagelabOtp(change.new_message_id, code)).verified === true)
      : isVerificationCodeValid(code, change.new_code_hash, change.new_code_expires_at)
    if (!valid) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

    const verifiedAt = new Date().toISOString()
    const { data: applied, error: applyError } = await service.rpc('apply_verified_contact_change', {
      p_request_id: requestId,
      p_user_id: user.id,
      p_verified_at: verifiedAt,
    })
    if (applyError || !applied) {
      if (applyError?.code === '23505') return NextResponse.json({ error: change.kind === 'phone' ? 'phone_exists' : 'email_exists' }, { status: 409 })
      console.error('[profile/contact-change/verify-new] apply failed', applyError)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    const authUpdate = change.kind === 'phone'
      ? await service.auth.admin.updateUserById(user.id, { phone: change.new_value, phone_confirm: true })
      : await service.auth.admin.updateUserById(user.id, { email: change.new_value, email_confirm: true })
    if (authUpdate.error) {
      console.error('[profile/contact-change/verify-new] auth update failed', authUpdate.error)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    // The current access token is the only session this route can preserve. A
    // subsequent middleware refresh will reject other refresh tokens after the
    // Auth identity update; do not pass a user id where Supabase expects a JWT.
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token
    if (accessToken) {
      const { error: revokeError } = await service.auth.admin.signOut(accessToken, 'others')
      if (revokeError) console.error('[profile/contact-change/verify-new] session invalidation failed', revokeError)
    }

    // C4 item 10: notify the old email when phone changes, so the user knows
    // their account was updated. This is a security notification, not optional.
    if (change.kind === 'phone') {
      try {
        const { data: profile } = await service
          .from('users')
          .select('email')
          .eq('id', user.id)
          .maybeSingle<{ email: string | null }>()
        const notifyEmail = profile?.email ?? user.email
        if (notifyEmail) {
          const { getResend } = await import('@/lib/resend/client')
          const resend = getResend()
          const ts = new Date().toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' })
          await resend.emails.send({
            from: 'Space8 <no-reply@space8.com.hk>',
            to: notifyEmail,
            subject: 'Your Space8 phone number was changed',
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;max-width:600px;margin:0 auto;padding:48px 24px;background:#000;color:#fff;">
  <div style="text-align:center;padding-bottom:32px;">
    <img src="https://space8.com.hk/logos/space8-logo-email.png" alt="Space8" width="280" style="max-width:100%;height:auto;" />
  </div>
  <div style="background:#0a0a0a;border-radius:24px;padding:40px;border:1px solid rgba(34,197,94,0.2);">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:rgba(34,197,94,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;">
        <span style="color:#22c55e;font-size:28px;">✓</span>
      </div>
    </div>
    <h2 style="color:#fff;font-size:22px;font-weight:600;margin:0 0 12px;text-align:center;">Phone Number Changed</h2>
    <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 28px;text-align:center;">Your Space8 account phone number was changed successfully.</p>
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="color:#a3a3a3;font-size:13px;margin:0 0 8px;"><strong style="color:#fff;">New Phone:</strong> ${change.new_value}</p>
      <p style="color:#a3a3a3;font-size:13px;margin:0;"><strong style="color:#fff;">Time:</strong> ${ts}</p>
    </div>
    <p style="color:#737373;font-size:14px;line-height:1.6;text-align:center;margin:0;">If you didn't make this change, please contact support immediately to secure your account.</p>
  </div>
  <p style="color:#525252;font-size:12px;text-align:center;margin:32px 0 0;">Space8 · Hong Kong</p>
</div>`,
          })
        }
      } catch (notifyErr) {
        // Best-effort — do not fail the main flow for a notification failure
        console.error('[profile/contact-change/verify-new] old-email notification failed', notifyErr)
      }
    }

    return NextResponse.json({ ok: true, kind: change.kind, value: change.new_value })
  } catch (error) {
    console.error('[profile/contact-change/verify-new] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
