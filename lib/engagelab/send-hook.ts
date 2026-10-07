// Supabase Send SMS Hook adapter — forwards Supabase's OTP requests to Engagelab
// https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook

// GoTrue serialises models.User, so a pending phone change arrives as
// `new_phone` (DB column `phone_change`). `sms.phone` is the destination GoTrue
// itself chose and is present on current GoTrue for every flow. `phone_change`
// and `email_change` are accepted defensively in case a version sends DB names.
// Source: supabase/auth internal/models/user.go, internal/hooks/v0hooks/v0hooks.go
export interface SendSmsHookPayload {
  user?: {
    id?: string
    phone?: string
    new_phone?: string
    phone_change?: string
    email?: string
    new_email?: string
    email_change?: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  }
  sms?: {
    otp?: string
    phone?: string
    sms_type?: string
  }
}

/** Destination phone for this OTP, across signup, login and phone change. */
export function resolveHookPhone(payload: SendSmsHookPayload): string | null {
  const phone =
    payload.sms?.phone ||
    payload.user?.phone ||
    payload.user?.new_phone ||
    payload.user?.phone_change
  return phone ? phone : null
}

/** Mask a phone to its last 3 digits for logs, e.g. "*****975". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length <= 3 ? '***' : `${'*'.repeat(digits.length - 3)}${digits.slice(-3)}`
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

  // ✅ CONFIRMED via official docs: https://engagelab.com/docs/otp/REST-API/CustomMessages-Send
  // Custom OTP Send endpoint: POST /v1/codes (NOT /v1/messages)
  // Request body structure per docs:
  const requestBody = {
    to: phone,
    code: otpCode,  // ← Top-level "code" field (NOT template.code or template.params.code)
    template: {
      id: templateId,
      language,
      // params: {} if template has custom variables beyond {{code}}
    },
  }

  // Never log otpCode or requestBody: both contain a live login code and the
  // full phone number, and Vercel runtime logs are readable by the whole team.

  // Official endpoint for "自訂驗證碼下發" (Custom OTP Send)
  const res = await fetch('https://otp.api.engagelab.cc/v1/codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authBase64}`,
    },
    body: JSON.stringify(requestBody),
  })

  // Get raw text first — don't assume it's valid JSON
  const rawText = await res.text()

  let data: EngagelabCustomOtpResponse
  try {
    data = JSON.parse(rawText) as EngagelabCustomOtpResponse
  } catch {
    throw {
      code: -1,
      message: `Engagelab returned non-JSON response: ${rawText.substring(0, 100)}`,
      httpStatus: res.status,
      rawText,
    }
  }

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
