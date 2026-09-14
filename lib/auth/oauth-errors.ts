// Unified OAuth error handling for Apple and Google sign-in
// Handles provider-specific errors, cancellation, and identity conflicts

export interface OAuthError {
  type: 'cancelled' | 'failed' | 'identity_linked' | 'session_expired' | 'network' | 'unknown'
  message: string
  canRetry: boolean
  identityType?: 'email' | 'phone'
}

/**
 * Maps Supabase OAuth errors to user-friendly messages.
 * Handles cancellation, provider failures, and identity conflicts.
 */
export function mapOAuthError(
  error: { message: string; status?: number },
  provider: 'google' | 'apple',
  t: (key: string, params?: Record<string, string | number>) => string
): OAuthError {
  const msg = error.message.toLowerCase()

  // User cancelled the OAuth flow
  if (msg.includes('cancel') || msg.includes('abort') || msg.includes('popup closed')) {
    return {
      type: 'cancelled',
      message: t('err_oauth_cancelled'),
      canRetry: true,
    }
  }

  // Identity already linked to another account
  if (msg.includes('already') && (msg.includes('link') || msg.includes('associated') || msg.includes('exist'))) {
    // Determine if it's email or phone based on error message
    const identityType = msg.includes('email') ? 'email' : msg.includes('phone') ? 'phone' : 'email'

    return {
      type: 'identity_linked',
      message: t('err_identity_already_linked', {
        type: t(identityType === 'email' ? 'identity_type_email' : 'identity_type_phone')
      }),
      canRetry: false,
      identityType,
    }
  }

  // Session expired during OAuth flow
  if (msg.includes('session') && msg.includes('expir')) {
    return {
      type: 'session_expired',
      message: t('err_session_expired'),
      canRetry: true,
    }
  }

  // Network or connectivity issues
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
    return {
      type: 'network',
      message: t('err_network'),
      canRetry: true,
    }
  }

  // Generic OAuth failure
  return {
    type: 'failed',
    message: t('err_oauth_failed'),
    canRetry: true,
  }
}

/**
 * Network error helper for OAuth flows
 */
export function oauthNetworkError(t: (key: string) => string): OAuthError {
  return {
    type: 'network',
    message: t('err_network'),
    canRetry: true,
  }
}
