import crypto from 'crypto'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// v4.2.0 (test): signed, short-lived token that lets the payment return page read a
// booking's coarse status without a session (e.g. when AlipayHK returns the customer to an
// in-app browser). It carries no personal data and only works for one booking.
// Gated by (1) RETURN_TOKEN_SECRET being set, (2) the admin-switchable `return_token` flag,
// (3) the booking owner being an active admin. Any failure means "no token" and the
// previous behaviour — it never blocks a payment.

export const RETURN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000

function secret(): string | null {
  const s = process.env.RETURN_TOKEN_SECRET
  return s && s.length >= 16 ? s : null
}

function sign(bookingId: string, exp: number, key: string): string {
  return crypto.createHmac('sha256', key).update(`${bookingId}.${exp}`).digest('base64url')
}

export function createReturnToken(bookingId: string, now = Date.now()): string | null {
  const key = secret()
  if (!key) return null
  const exp = now + RETURN_TOKEN_TTL_MS
  return `${exp}.${sign(bookingId, exp, key)}`
}

export function verifyReturnToken(token: string, bookingId: string, now = Date.now()): boolean {
  const key = secret()
  if (!key || typeof token !== 'string' || token.length > 200) return false
  const [expRaw, sig] = token.split('.')
  const exp = Number(expRaw)
  if (!sig || !Number.isFinite(exp) || exp < now || exp > now + RETURN_TOKEN_TTL_MS + 60_000) return false
  const expected = Buffer.from(sign(bookingId, exp, key))
  const given = Buffer.from(sig)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export type ReturnTokenMode = 'off' | 'admins'

export async function getReturnTokenMode(): Promise<ReturnTokenMode> {
  try {
    const { data, error } = await getLegacyServiceSupabase()
      .from('payment_feature_flags')
      .select('mode')
      .eq('key', 'return_token')
      .maybeSingle()
    if (error || !data) return 'off'
    return data.mode === 'admins' ? 'admins' : 'off'
  } catch {
    return 'off'
  }
}

async function isActiveAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await getLegacyServiceSupabase()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('invite_status', 'active')
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}

/** Token for a new order, or null when the feature is off / not for this account. */
export async function mintReturnTokenFor(userId: string, bookingId: string): Promise<string | null> {
  if (!secret()) return null
  if ((await getReturnTokenMode()) !== 'admins') return null
  if (!(await isActiveAdmin(userId))) return null
  return createReturnToken(bookingId)
}

/** True when a token may be honoured now for this booking owner (flag on, owner is admin). */
export async function isReturnTokenAllowedFor(ownerUserId: string): Promise<boolean> {
  if ((await getReturnTokenMode()) !== 'admins') return false
  return isActiveAdmin(ownerUserId)
}
