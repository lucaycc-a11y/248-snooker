import { getServiceSupabase } from '@/lib/supabase/service'
import crypto from 'crypto'

export type TokenValidationResult =
  | { ok: true; requestId: string; userId: string }
  | { ok: false; error: 'invalid' | 'expired' | 'used' | 'wrong_user' | 'internal' }

// Validates a change request token against the database.
// Checks: token exists, not expired, not used, matches purpose, user matches.
// This is called on page load and again on form submit for atomicity.
export async function validateChangeToken(
  token: string,
  purpose: 'password' | 'phone',
  expectedUserId: string
): Promise<TokenValidationResult> {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const service = getServiceSupabase()

    const { data: request, error } = await service
      .from('account_change_requests')
      .select('id, user_id, purpose, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .eq('purpose', purpose)
      .maybeSingle<{
        id: string
        user_id: string
        purpose: string
        expires_at: string
        used_at: string | null
      }>()

    if (error) {
      console.error('[validateChangeToken] DB error:', error)
      return { ok: false, error: 'internal' }
    }

    if (!request) {
      return { ok: false, error: 'invalid' }
    }

    if (request.used_at) {
      return { ok: false, error: 'used' }
    }

    if (new Date(request.expires_at) < new Date()) {
      return { ok: false, error: 'expired' }
    }

    if (request.user_id !== expectedUserId) {
      return { ok: false, error: 'wrong_user' }
    }

    return { ok: true, requestId: request.id, userId: request.user_id }
  } catch (err) {
    console.error('[validateChangeToken] error:', err)
    return { ok: false, error: 'internal' }
  }
}

// Marks a token as used atomically. Returns true if successful (token was unused).
// Returns false if token was already used (prevents double-submit).
export async function consumeChangeToken(requestId: string): Promise<boolean> {
  try {
    const service = getServiceSupabase()

    // Atomic update: only succeeds if used_at is still null
    const { data, error } = await service
      .from('account_change_requests')
      .update({ used_at: new Date().toISOString() })
      .eq('id', requestId)
      .is('used_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[consumeChangeToken] DB error:', error)
      return false
    }

    return !!data
  } catch (err) {
    console.error('[consumeChangeToken] error:', err)
    return false
  }
}
