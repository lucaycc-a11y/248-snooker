import { NextRequest, NextResponse } from 'next/server'
import {
  sendSupabaseOtpViaEngagelab,
  verifySupabaseHookSignature,
  type SendSmsHookPayload,
} from '@/lib/engagelab/send-hook'
import { mapEngagelabError } from '@/lib/engagelab/otp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Supabase Send SMS Hook — forwards Supabase's phone OTP requests to Engagelab
 *
 * This endpoint is called by Supabase whenever a user requests a phone OTP (via
 * signInWithOtp({ phone }) or verifyOtp). Supabase generates the OTP code and
 * sends it to this hook; we forward it to Engagelab for delivery via SMS/WhatsApp.
 *
 * Flow:
 * 1. User calls supabase.auth.signInWithOtp({ phone: '+85266009975' })
 * 2. Supabase generates a 6-digit OTP code
 * 3. Supabase POSTs to this endpoint with { user: { phone }, sms: { otp } }
 * 4. We verify the request signature (proves it's from Supabase, not a spoof)
 * 5. We send the OTP to the user's phone via Engagelab
 * 6. We return success/failure to Supabase
 *
 * Security:
 * - Request signature verification prevents unauthorized SMS sending
 * - Only responds to requests signed by Supabase using the webhook secret
 * - Logs all attempts for audit trail
 *
 * Configuration:
 * - SUPABASE_AUTH_HOOK_SECRET: The signing secret from Supabase Dashboard
 * - ENGAGELAB_AUTH_BASE64: Engagelab API credentials
 *
 * Supabase Dashboard setup:
 * 1. Authentication → Hooks → Send SMS hook
 * 2. Choose "HTTPS" type
 * 3. Enter this endpoint's production URL
 * 4. Copy the signing secret to SUPABASE_AUTH_HOOK_SECRET env var
 *
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 */
export async function POST(req: NextRequest) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET

  if (!hookSecret) {
    console.error(JSON.stringify({
      event: 'send_sms_hook.config_missing',
      error: 'SUPABASE_AUTH_HOOK_SECRET not configured',
    }))
    return NextResponse.json(
      { error: 'Hook not configured' },
      { status: 503 }
    )
  }

  // Read the raw body for signature verification
  const rawBody = await req.text()
  const signature = req.headers.get('x-supabase-signature')

  // Verify the request is genuinely from Supabase
  const isValid = await verifySupabaseHookSignature(rawBody, signature, hookSecret)

  if (!isValid) {
    console.warn(JSON.stringify({
      event: 'send_sms_hook.invalid_signature',
      hasSignature: !!signature,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    }))
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // Parse the validated payload
  let payload: SendSmsHookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error(JSON.stringify({
      event: 'send_sms_hook.invalid_json',
    }))
    return NextResponse.json(
      { error: 'Invalid payload' },
      { status: 400 }
    )
  }

  const { user, sms } = payload

  if (!user?.phone || !sms?.otp) {
    console.error(JSON.stringify({
      event: 'send_sms_hook.missing_fields',
      hasPhone: !!user?.phone,
      hasOtp: !!sms?.otp,
    }))
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  // Detect language from user metadata (set during profile completion)
  // or default to zh_HK
  const language = (user.user_metadata?.locale as string | undefined) || 'zh_HK'

  try {
    const result = await sendSupabaseOtpViaEngagelab(user.phone, sms.otp, language)

    console.info(JSON.stringify({
      event: 'send_sms_hook.success',
      userId: user.id,
      phone: user.phone.replace(/\d{4}$/, '****'), // Mask last 4 digits for privacy
      messageId: result.message_id,
      channel: result.send_channel,
    }))

    // Supabase expects a 200 response with empty body on success
    return new NextResponse(null, { status: 200 })
  } catch (error: unknown) {
    console.error(JSON.stringify({
      event: 'send_sms_hook.engagelab_failed',
      userId: user.id,
      phone: user.phone.replace(/\d{4}$/, '****'),
      error: error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : 'Unknown error',
      code: error && typeof error === 'object' && 'code' in error
        ? (error as { code: number }).code
        : null,
    }))

    // Map Engagelab error codes to user-friendly messages
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: number }).code
      if (typeof code === 'number') {
        const message = mapEngagelabError(code)
        return NextResponse.json(
          { error: message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
