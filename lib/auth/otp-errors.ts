// Unified OTP error handling for Supabase Auth + Engagelab SMS provider
// Centralizes error mapping logic previously duplicated across AuthCard and ProfileCompletion

export interface OtpSendError {
  type: 'network' | 'rate_limited' | 'engagelab' | 'recaptcha' | 'server' | 'unknown'
  message: string
  retryAfterSeconds?: number
  engagelabCode?: number
  canRetry: boolean
  action: 'retry' | 'switch_method' | 'contact_support' | 'wait'
}

export interface OtpVerifyError {
  type: 'wrong_code' | 'expired' | 'exhausted' | 'rate_limited' | 'network' | 'unknown'
  message: string
  attemptsLeft?: number
  needsResend: boolean
}

/**
 * Maps Engagelab-specific error codes to user-friendly messages.
 * Called when the SMS provider returns an error during OTP send.
 */
export function mapEngagelabSendError(
  code: number,
  t: (key: string, params?: Record<string, string | number>) => string
): OtpSendError {
  switch (code) {
    case 3004: // Code already sent (still valid)
      return {
        type: 'engagelab',
        message: t('err_code_already_sent'),
        engagelabCode: 3004,
        canRetry: false,
        action: 'retry', // Special: advance to OTP entry with existing code
      }

    case 5011: // Rate limit - too many requests
    case 5013: // Rate limit - daily limit
      return {
        type: 'rate_limited',
        message: t('err_phone_rate_limited'),
        retryAfterSeconds: 300, // 5 min cooldown for rate limits
        engagelabCode: code,
        canRetry: true,
        action: 'wait',
      }

    case 5018: // Invalid phone format
      return {
        type: 'engagelab',
        message: t('err_phone_format'),
        engagelabCode: 5018,
        canRetry: true,
        action: 'retry',
      }

    case 5019: // Phone blacklisted
      return {
        type: 'engagelab',
        message: t('err_phone_blacklisted'),
        engagelabCode: 5019,
        canRetry: false,
        action: 'switch_method',
      }

    case 5020: // Phone disconnected/unreachable
      return {
        type: 'engagelab',
        message: t('err_phone_disconnected'),
        engagelabCode: 5020,
        canRetry: false,
        action: 'switch_method',
      }

    case 6001: // SMS service unavailable
    case 6003: // SMS gateway error
    case 6006: // Delivery failure
    case 6007: // Provider error
      return {
        type: 'server',
        message: t('err_sms_unavailable'),
        engagelabCode: code,
        canRetry: true,
        action: 'switch_method',
      }

    default:
      return {
        type: 'unknown',
        message: t('err_send'),
        engagelabCode: code,
        canRetry: true,
        action: 'contact_support',
      }
  }
}

/**
 * Maps Supabase Auth errors during OTP send (signInWithOtp or updateUser).
 * Handles rate limiting, invalid phone, and generic send failures.
 */
export function mapSupabaseSendError(
  error: { message: string; status?: number },
  t: (key: string, params?: Record<string, string | number>) => string
): OtpSendError {
  const msg = error.message.toLowerCase()

  // Rate limiting
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return {
      type: 'rate_limited',
      message: t('err_rate_limited'),
      retryAfterSeconds: 60,
      canRetry: true,
      action: 'wait',
    }
  }

  // Invalid phone format
  if (msg.includes('invalid phone')) {
    return {
      type: 'server',
      message: t('err_phone_format'),
      canRetry: true,
      action: 'retry',
    }
  }

  // Phone already registered (during signup)
  if (msg.includes('already been registered') || msg.includes('already exists')) {
    return {
      type: 'server',
      message: t('err_phone_exists'),
      canRetry: false,
      action: 'contact_support',
    }
  }

  // Generic send failure
  return {
    type: 'unknown',
    message: t('err_send'),
    canRetry: true,
    action: 'retry',
  }
}

/**
 * Maps Supabase Auth errors during OTP verification (verifyOtp).
 * Handles wrong code, expired code, rate limiting, and attempt exhaustion.
 */
export function mapSupabaseVerifyError(
  error: { message: string; status?: number },
  attemptsLeft: number,
  t: (key: string, params?: Record<string, string | number>) => string
): OtpVerifyError {
  const msg = error.message.toLowerCase()

  // Rate limiting during verification
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return {
      type: 'rate_limited',
      message: t('err_rate_limited'),
      attemptsLeft,
      needsResend: false,
    }
  }

  // Token expired
  if (msg.includes('expired') || msg.includes('expir')) {
    return {
      type: 'expired',
      message: t('err_otp_expired'),
      attemptsLeft: 0,
      needsResend: true,
    }
  }

  // Wrong code - check attempts remaining
  if (msg.includes('invalid') || msg.includes('token') || msg.includes('otp')) {
    if (attemptsLeft <= 0) {
      return {
        type: 'exhausted',
        message: t('err_otp_locked'),
        attemptsLeft: 0,
        needsResend: true,
      }
    }

    return {
      type: 'wrong_code',
      message: t('err_otp_wrong', { count: attemptsLeft }),
      attemptsLeft,
      needsResend: false,
    }
  }

  // Generic verification error
  return {
    type: 'unknown',
    message: t('err_otp_wrong_generic'),
    attemptsLeft,
    needsResend: false,
  }
}

/**
 * Network error helper - for catch blocks when fetch/API call fails
 */
export function networkError(t: (key: string, params?: Record<string, string | number>) => string): OtpSendError {
  return {
    type: 'network',
    message: t('err_network'),
    canRetry: true,
    action: 'retry',
  }
}

/**
 * reCAPTCHA error helper - when reCAPTCHA token generation fails
 */
export function recaptchaError(t: (key: string, params?: Record<string, string | number>) => string): OtpSendError {
  return {
    type: 'recaptcha',
    message: t('err_send'),
    canRetry: true,
    action: 'retry',
  }
}
