import crypto from 'node:crypto'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getClientIp, getUserAgent } from '@/lib/security/audit-log'
import { termsZhHK } from '@/content/legal/terms.zh-HK'

// Evidence of agreement to 《場地使用守則及條款》. Recorded server-side at the checkout routes that
// enforce the agree-terms gate, so it cannot be skipped by a client. Best-effort: a failed insert
// is logged but never blocks a payment.

/** Bump when the terms change in substance (the hash below changes on any edit anyway). */
export const TERMS_VERSION = '2026-10-31'

export const termsHash: string = crypto.createHash('sha256').update(JSON.stringify(termsZhHK)).digest('hex')

export type TermsAcceptance = { acceptedAt: string; version: string; hash: string }

export async function recordTermsAcceptance(input: {
  userId: string
  req: Request
  source: 'checkout' | 'paymentx'
  isTest?: boolean
}): Promise<void> {
  try {
    const db = getLegacyServiceSupabase()
    // Retries of the same checkout within 10 minutes are one agreement, not many.
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data: recent } = await db
      .from('terms_acceptances')
      .select('id')
      .eq('user_id', input.userId)
      .eq('terms_hash', termsHash)
      .gte('accepted_at', since)
      .limit(1)
    if (recent && recent.length > 0) return
    const { error } = await db.from('terms_acceptances').insert({
      user_id: input.userId,
      terms_version: TERMS_VERSION,
      terms_hash: termsHash,
      source: input.source,
      ip: getClientIp(input.req),
      user_agent: getUserAgent(input.req)?.slice(0, 300) ?? null,
      is_test: input.isTest === true,
    })
    if (error) console.error('[terms-acceptance] insert failed', error.message)
  } catch (e) {
    console.error('[terms-acceptance] failed', (e as Error).message)
  }
}

/** The agreement in force at `at` (latest one on or before it), else the earliest one on record. */
export async function findTermsAcceptance(userId: string, at: string | null): Promise<TermsAcceptance | null> {
  try {
    const db = getLegacyServiceSupabase()
    const { data } = await db
      .from('terms_acceptances')
      .select('accepted_at, terms_version, terms_hash')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false })
      .limit(50)
    const rows = ((data ?? []) as unknown[]).filter(
      (r): r is { accepted_at: string; terms_version: string; terms_hash: string } =>
        typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).accepted_at === 'string',
    )
    if (rows.length === 0) return null
    const cutoff = at ? new Date(at).getTime() : Date.now()
    const before = rows.find((r) => new Date(r.accepted_at).getTime() <= cutoff)
    const pick = before ?? rows[rows.length - 1]
    return { acceptedAt: pick.accepted_at, version: pick.terms_version, hash: pick.terms_hash }
  } catch {
    return null
  }
}
