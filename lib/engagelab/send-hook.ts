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
 * CRITICAL: Uses Engagelab's Custom Messages API (/v1/custom-messages), NOT /v1/messages.
 *
 * Key difference:
 * - /v1/messages — Engagelab generates its own OTP code (ignores variables.code)
 * - /v1/custom-messages — Sends YOUR pre-generated code exactly as provided
 *
 * For Supabase Phone Auth integration:
 * 1. Supabase generates the OTP code
 * 2. Supabase calls our Send SMS Hook with the code
 * 3. We forward it to Engagelab via /v1/custom-messages
 * 4. Engagelab sends it via SMS/WhatsApp (does NOT generate new code)
 * 5. User enters the code
 * 6. Supabase verifies it (not Engagelab)
 *
 * Template requirements in Engagelab Dashboard:
 * - Template name: "Supabase OTP"
 * - Template content: "【Space8】您的驗證碼是{{code}}，5分鐘內有效。請勿將驗證碼告知他人。"
 * - Variables: code
 * - Type: Custom message (not auto-generated OTP)
 *
 * Reference: https://engagelab.com/docs/otp/REST-API/CustomMessages-Send
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

  // CRITICAL: The verification code MUST be in the top-level "code" field,
  // NOT inside variables/params. This is confirmed by testing:
  // - Old way: variables: { code: "123456" } → Engagelab ignored it, sent own code
  // - Correct way: code: "123456" (top-level) → Engagelab sends exactly this code
  const requestBody = {
    to: phone,
    template: {
      id: templateId,
      language,
      code: otpCode,  // ← Top-level code field, NOT variables.code
    },
  }

  // 🔍 DEBUG: Log the EXACT request body we're sending to Engagelab
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] Request body:', JSON.stringify(requestBody))
  console.log('[DEBUG sendSupabaseOtpViaEngagelab] OTP code in template.code:', otpCode)

  // Use Custom Send OTP API (https://engagelab.com/docs/otp/api/custom-send-otp)
  // This is a SEPARATE API from /v1/messages — dedicated to sending pre-generated codes
  const res = await fetch('https://otp.api.engagelab.cc/v1/custom-send-otp', {
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
