// Password authentication error handling
// Distinguishes between wrong password and password not set

export interface PasswordError {
  type: 'wrong_password' | 'no_password_set' | 'network' | 'unknown'
  message: string
  canRetry: boolean
  suggestOtp?: boolean
}

/**
 * Maps Supabase password authentication errors to user-friendly messages.
 * Distinguishes between "wrong password" and "password not set for this account".
 */
export function mapPasswordError(
  error: { message: string; status?: number },
  t: (key: string) => string
): PasswordError {
  const msg = error.message.toLowerCase()

  // Password not set for this account (OAuth users, SMS-only users)
  if (msg.includes('password') && (msg.includes('not set') || msg.includes('no password'))) {
    return {
      type: 'no_password_set',
      message: t('err_password_not_set'),
      canRetry: false,
      suggestOtp: true,
    }
  }

  // Wrong password
  if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('credentials')) {
    return {
      type: 'wrong_password',
      message: t('err_password_wrong'),
      canRetry: true,
      suggestOtp: false,
    }
  }

  // Network error
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
    return {
      type: 'network',
      message: t('err_network'),
      canRetry: true,
      suggestOtp: false,
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: t('err_generic'),
    canRetry: true,
    suggestOtp: false,
  }
}
