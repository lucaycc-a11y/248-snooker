/**
 * Section 4: Unified OTP error handling module
 *
 * This module provides centralized error handling for OTP send and verify operations.
 * Used by BOTH AuthCard.tsx and ProfileCompletion.tsx to avoid duplicating logic.
 *
 * Every error case in Section 4.1 (Send) and 4.2 (Verify) gets its own distinct handler.
 */

export interface OtpSendError {
  type: 'network' | 'rate_limited' | 'engagelab' | 'recaptcha' | 'server' | 'unknown'
  message: string
  /** For rate limiting: seconds to wait before retry */
  retryAfterSeconds?: number
  /** For Engagelab errors: the original error code */
  engagelabCode?: number
  /** Whether retry is allowed (false for blacklist/unsubscribed) */
  canRetry: boolean
  /** Suggested action for the user */
  action: 'retry' | 'switch_method' | 'contact_support' | 'wait'
}

export interface OtpVerifyError {
  type: 'wrong_code' | 'expired' | 'exhausted' | 'rate_limited' | 'network' | 'unknown'
  message: string
  /** Attempts remaining (for wrong_code) */
  attemptsLeft?: number
  /** Whether the OTP request is now dead and needs resend */
  needsResend: boolean
}

/**
 * Map Engagelab error codes to user-facing errors (Section 4.1 table)
 */
export function mapEngagelabSendError(code: number, t: (key: string) => string): OtpSendError {
  switch (code) {
    case 3004: // Unexpired code already exists
      return {
        type: 'engagelab',
        message: t('err_code_already_sent'),
        engagelabCode: code,
        canRetry: false,
        action: 'retry', // Route to OTP entry screen
      }
    case 6001: // Phone-level frequency limit
      return {
        type: 'rate_limited',
        message: t('err_phone_rate_limited'),
        engagelabCode: code,
        retryAfterSeconds: 300, // Conservative 5min
        canRetry: true,
        action: 'wait',
      }
    case 5011: // Invalid format
    case 5020: // Unregistered number
      return {
        type: 'engagelab',
        message: t('err_phone_format'),
        engagelabCode: code,
        canRetry: true,
        action: 'retry',
      }
    case 5013: // Blacklisted
    case 5019: // Unsubscribed
      return {
        type: 'engagelab',
        message: t('err_phone_blacklisted'),
        engagelabCode: code,
        canRetry: false,
        action: 'switch_method',
      }
    case 5018: // Phone off/disconnected
      return {
        type: 'engagelab',
        message: t('err_phone_disconnected'),
        engagelabCode: code,
        canRetry: true,
        action: 'retry',
      }
    case 6006: // Region suspended
    case 6007: // Service suspended
      return {
        type: 'engagelab',
        message: t('err_sms_unavailable'),
        engagelabCode: code,
        canRetry: false,
        action: 'switch_method',
      }
    default:
      return {
        type: 'engagelab',
        message: t('err_send'),
        engagelabCode: code,
        canRetry: true,
        action: 'retry',
      }
  }
}

/**
 * Map Supabase signInWithOtp errors to user-facing errors
 */
export function mapSupabaseSendError(error: { message: string; status?: number }, t: (key: string) => string): OtpSendError {
  const msg = error.message.toLowerCase()

  if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return {
      type: 'rate_limited',
      message: t('err_rate_limited'),
      retryAfterSeconds: 60,
      canRetry: true,
      action: 'wait',
    }
  }

  if (msg.includes('invalid phone') || msg.includes('invalid email')) {
    return {
      type: 'engagelab',
      message: t('err_phone_format'),
      canRetry: true,
      action: 'retry',
    }
  }

  return {
    type: 'server',
    message: t('err_send'),
    canRetry: true,
    action: 'retry',
  }
}

/**
 * Map Supabase verifyOtp errors to user-facing errors (Section 4.2 table)
 */
export function mapSupabaseVerifyError(
  error: { message: string; status?: number },
  attemptsLeft: number,
  t: (key: string, params?: Record<string, unknown>) => string
): OtpVerifyError {
  const msg = error.message.toLowerCase()

  // Rate limited
  if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return {
      type: 'rate_limited',
      message: t('err_rate_limited'),
      needsResend: false,
    }
  }

  // Expired (distinct from wrong code)
  if (msg.includes('expired') || msg.includes('otp_expired')) {
    return {
      type: 'expired',
      message: t('err_otp_expired'),
      needsResend: true,
    }
  }

  // Wrong code
  if (attemptsLeft > 0) {
    return {
      type: 'wrong_code',
      message: t('err_otp_wrong', { count: attemptsLeft }),
      attemptsLeft,
      needsResend: false,
    }
  } else {
    // Attempts exhausted
    return {
      type: 'exhausted',
      message: t('err_otp_locked'),
      needsResend: true,
    }
  }
}

/**
 * Network error handler (for fetch failures, not server errors)
 */
export function networkError(t: (key: string) => string): OtpSendError {
  return {
    type: 'network',
    message: t('err_network'),
    canRetry: true,
    action: 'retry',
  }
}

/**
 * reCAPTCHA error handler
 */
export function recaptchaError(t: (key: string) => string): OtpSendError {
  return {
    type: 'recaptcha',
    message: t('err_send'), // Don't expose reCAPTCHA details to user
    canRetry: true,
    action: 'retry',
  }
}
