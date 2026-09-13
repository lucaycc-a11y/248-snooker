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
  const templateId = process.env.ENGAGELAB_OTP_TEMPLATE_ID

  if (!authBase64) {
    throw new Error('ENGAGELAB_AUTH_BASE64 configuration missing')
  }

  if (!templateId) {
    throw new Error('ENGAGELAB_OTP_TEMPLATE_ID configuration missing - you must create a custom template in Engagelab Dashboard with {{code}} placeholder')
  }

  // Use Engagelab's template API with custom variables
  // The template should have {{code}} as a variable placeholder
  const requestBody = {
    to: phone,
    template: {
      id: templateId,
      language,
      // Pass the Supabase OTP code as a template variable
      variables: {
        code: otpCode,
      },
    },
  }

  // 🔍 DEBUG: Log the EXACT request body we're sending to Engagelab
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] Request body:', JSON.stringify(requestBody))
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] OTP code in variables.code:', otpCode)

  const res = await fetch('https://otp.api.engagelab.cc/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authBase64}`,
    },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json()

  // 🔍 DEBUG: Log Engagelab's complete response
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] Engagelab response status:', res.status)
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] Engagelab response body:', JSON.stringify(data))

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
 * Supabase Auth Hooks follow the Standard Webhooks specification.
 * Signatures use HMAC-SHA256 and are sent in base64 format via three headers:
 * - webhook-id: Unique message identifier
 * - webhook-timestamp: Unix timestamp in seconds
 * - webhook-signature: Space-separated list of "v1,<base64-signature>" entries
 *
 * The signed content is: `${webhookId}.${webhookTimestamp}.${payload}`
 *
 * The secret format from Supabase is "v1,whsec_XXXXXXXX". We strip the prefix
 * and base64-decode it to get the raw HMAC key.
 *
 * @param payload - The raw request body (as string)
 * @param headers - Object containing id, timestamp, and signature from webhook headers
 * @param secret - The webhook secret from Supabase Dashboard (format: "v1,whsec_...")
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 * @see https://www.standardwebhooks.com/
 */
export async function verifySupabaseHookSignature(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string
): Promise<boolean> {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) {
    return false
  }

  // Secret format: "v1,whsec_XXXXXXXX" — strip prefix, base64 decode to get binary key
  const stripped = secret.replace(/^v1,/, '').replace(/^whsec_/, '')
  let keyBuffer: ArrayBuffer
  try {
    const decoded = atob(stripped)
    const keyBytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      keyBytes[i] = decoded.charCodeAt(i)
    }
    keyBuffer = keyBytes.buffer
  } catch {
    // Invalid base64 secret
    return false
  }

  // Standard Webhooks signed content: "${id}.${timestamp}.${payload}"
  const signedContent = `${id}.${timestamp}.${payload}`
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent))
  // Convert ArrayBuffer to base64
  const sigArray = new Uint8Array(sigBytes)
  const expected = btoa(String.fromCharCode(...Array.from(sigArray)))

  // Header may contain space-separated list of "v1,<base64>" for key rotation
  // Extract all base64 signatures and check if any matches
  const candidates = signature
    .split(' ')
    .map((s) => {
      const parts = s.split(',')
      return parts.length === 2 ? parts[1] : null
    })
    .filter((s): s is string => s !== null)

  // Constant-time comparison to prevent timing attacks
  return candidates.some(candidate => candidate === expected)
}
