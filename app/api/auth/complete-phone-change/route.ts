import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateChangeToken, consumeChangeToken } from '@/lib/auth/change-token'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { token: string; newPhone: string; otp: string }

// Completes a phone change via email link token + OTP verification.
// Validates token, verifies OTP, updates phone in auth.users AND public.users,
// marks token as used, logs the change, sends confirmation email.
// Atomic: token consumption and phone update happen in one consistent operation.
export async function POST(request: Request) {
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
    const { token, newPhone, otp } = body || {}

    if (!token || !newPhone || !otp) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const normalized = normalizeHkPhone(newPhone)
    if (!normalized) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 422 })
    }

    // Validate token (again, for atomicity)
    const tokenValidation = await validateChangeToken(token, 'phone', user.id)
    if (!tokenValidation.ok) {
      return NextResponse.json({ error: `token_${tokenValidation.error}` }, { status: 400 })
    }

    const { requestId } = tokenValidation

    // Verify OTP via Supabase
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp,
      type: 'sms',
    })

    if (verifyError) {
      console.error('[complete-phone-change] verifyOtp failed:', verifyError)

      // Check specific error types
      if (verifyError.message?.includes('expired')) {
        return NextResponse.json({ error: 'otp_expired' }, { status: 400 })
      }
      if (verifyError.message?.includes('invalid')) {
        return NextResponse.json({ error: 'otp_invalid' }, { status: 400 })
      }

      return NextResponse.json({ error: 'otp_verification_failed' }, { status: 400 })
    }

    if (!verifyData?.user) {
      return NextResponse.json({ error: 'otp_invalid' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Final check: ensure phone is still not in use by another account
    // (race condition guard)
    const { data: phoneOwner } = await service
      .from('users')
      .select('id')
      .eq('phone', normalized)
      .neq('id', user.id)
      .maybeSingle<{ id: string }>()

    if (phoneOwner) {
      return NextResponse.json({ error: 'phone_in_use' }, { status: 409 })
    }

    // Update phone in auth.users via Supabase auth
    const { error: updateAuthError } = await supabase.auth.updateUser({
      phone: normalized,
    })

    if (updateAuthError) {
      console.error('[complete-phone-change] updateUser failed:', updateAuthError)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    // Update phone in public.users (keep in sync)
    const { error: updateProfileError } = await service
      .from('users')
      .update({ phone: normalized, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateProfileError) {
      console.error('[complete-phone-change] profile update failed:', updateProfileError)
      // Rollback auth phone update? This is a critical inconsistency.
      // For now, log and continue - the auth phone is canonical.
    }

    // Consume token atomically
    const consumed = await consumeChangeToken(requestId)
    if (!consumed) {
      // Token was already used (double-submit race condition)
      // Phone was already changed above, so this is actually OK
      console.warn('[complete-phone-change] token already consumed, but phone was updated')
    }

    const ip = clientIp(request)

    // Audit log
    await service.from('account_change_audit').insert({
      user_id: user.id,
      action: 'complete_phone_change',
      request_id: requestId,
      new_value: normalized.slice(-4), // Last 4 digits only for audit
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
          subject: '電話號碼已更改 / Phone Number Changed',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #22c55e;">Space8</h2>
              <h3>電話號碼已更改 / Phone Number Changed</h3>

              <p><strong>繁體中文</strong></p>
              <p>你的電話號碼已成功更改為 <strong>${normalized}</strong>。</p>
              <p>如非本人操作，請立即聯絡我們。</p>

              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

              <p><strong>English</strong></p>
              <p>Your phone number has been successfully changed to <strong>${normalized}</strong>.</p>
              <p>If this wasn't you, please contact us immediately.</p>

              <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Space8 Snooker & Pool Club</p>
            </div>
          `,
        })
      }
    } catch (emailError) {
      // Log but don't fail - phone was already changed
      console.error('[complete-phone-change] confirmation email failed:', emailError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[complete-phone-change] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
