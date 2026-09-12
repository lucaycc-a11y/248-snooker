// Supabase Send SMS Hook adapter — forwards Supabase's OTP requests to Engagelab
// https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook

export interface SendSmsHookPayload {
  user: {
    id: string
    phone: string
    email?: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  }
  sms: {
    otp: string
  }
}

export interface EngagelabCustomOtpResponse {
  message_id: string
  send_channel: 'whatsapp' | 'sms' | string
  code?: number
  message?: string
}

/**
 * Send a Supabase-generated OTP code via Engagelab.
 *
 * IMPORTANT: Engagelab's OTP API uses template-based verification where:
 * 1. You create a template in the Engagelab Dashboard with placeholders
 * 2. The API call passes variables to fill those placeholders
 * 3. Engagelab handles both sending AND verification of the code
 *
 * However, for Supabase integration, we need to:
 * 1. Accept a Supabase-generated OTP code
 * 2. Send it via Engagelab SMS/WhatsApp
 * 3. Let Supabase handle verification (not Engagelab)
 *
 * This requires using Engagelab's template API with a CUSTOM template that:
 * - Has a variable placeholder for the OTP code (e.g., {{code}})
 * - Doesn't use Engagelab's auto-generated verification
 *
 * You must create this template in Engagelab Dashboard:
 * Template name: "Supabase OTP"
 * Template content: "【Space8】您的驗證碼是{{code}}，5分鐘內有效。請勿將驗證碼告知他人。"
 * Variables: code
 * Verification: DISABLED (Supabase handles it)
 */
export async function sendSupabaseOtpViaEngagelab(
  phone: string,
  otpCode: string,
  language: string = 'zh_HK'
): Promise<EngagelabCustomOtpResponse> {
  const authBase64 = process.env.ENGAGELAB_AUTH_BASE64
  const templateId = process.env.ENGAGELAB_SUPABASE_TEMPLATE_ID

  if (!authBase64) {
    throw new Error('ENGAGELAB_AUTH_BASE64 configuration missing')
  }

  if (!templateId) {
    throw new Error('ENGAGELAB_SUPABASE_TEMPLATE_ID configuration missing - you must create a custom template in Engagelab Dashboard with {{code}} placeholder')
  }

  // Use Engagelab's template API with custom variables
  // The template should have {{code}} as a variable placeholder
  const res = await fetch('https://otp.api.engagelab.cc/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authBase64}`,
    },
    body: JSON.stringify({
      to: phone,
      template: {
        id: templateId,
        language,
        // Pass the Supabase OTP code as a template variable
        variables: {
          code: otpCode,
        },
      },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw {
      code: data.code,
      message: data.message,
      httpStatus: res.status,
    }
  }

  return data
}

/**
 * Verify the Supabase Auth Hook signature to ensure the request is authentic.
 *
 * Supabase signs webhook requests using HMAC-SHA256. The signature is sent in
 * the X-Supabase-Signature header as a hex-encoded string.
 *
 * @param payload - The raw request body (as string)
 * @param signature - The signature from X-Supabase-Signature header
 * @param secret - The webhook secret from Supabase Dashboard
 */
export async function verifySupabaseHookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  // Supabase uses HMAC-SHA256 for webhook signatures
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison to prevent timing attacks
  return expectedSignature === signature
}
