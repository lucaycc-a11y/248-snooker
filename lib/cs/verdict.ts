/**
 * Spark's machine-readable verdict on a CS case. The model ends its diagnosis with one line
 *   VERDICT {"type":"…","website":"…","action":"…"}
 * which is parsed here (never trusted blindly), stored on the case and stripped from the text
 * the admin reads.
 */

export const VERDICT_TYPES = ['user_error', 'payment_unconfirmed', 'payment_failed', 'website_bug', 'slot_conflict', 'account', 'unknown'] as const
export type VerdictType = (typeof VERDICT_TYPES)[number]
export const VERDICT_WEBSITE = ['yes', 'no', 'unknown'] as const
export type VerdictWebsite = (typeof VERDICT_WEBSITE)[number]
export const VERDICT_ACTIONS = ['payment_link', 'check_payment', 'review_booking', 'reply_only', 'escalate'] as const
export type VerdictAction = (typeof VERDICT_ACTIONS)[number]

export type CsVerdict = { type: VerdictType; website: VerdictWebsite; action: VerdictAction; at: string }

export const VERDICT_TYPE_LABEL: Record<VerdictType, string> = {
  user_error: '客人操作問題',
  payment_unconfirmed: '已付款未確認',
  payment_failed: '付款失敗',
  website_bug: '網站 bug',
  slot_conflict: '時段衝突',
  account: '帳戶問題',
  unknown: '未能確定',
}
export const VERDICT_ACTION_LABEL: Record<VerdictAction, string> = {
  payment_link: '生成付款連結',
  check_payment: '核實付款',
  review_booking: '檢查預約',
  reply_only: '直接回覆客人',
  escalate: '交俾 Luca 跟進',
}

function oneOf<T extends string>(list: readonly T[], v: unknown): T | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null
}

export function isCsVerdict(v: unknown): v is CsVerdict {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return !!oneOf(VERDICT_TYPES, r.type) && !!oneOf(VERDICT_WEBSITE, r.website) && !!oneOf(VERDICT_ACTIONS, r.action) && typeof r.at === 'string'
}

/** Splits the model output into the readable text and the parsed verdict (null if absent / invalid). */
export function splitVerdict(raw: string): { text: string; verdict: CsVerdict | null } {
  const m = /^\s*VERDICT\s*(\{.*\})\s*$/m.exec(raw)
  const text = raw.replace(/^\s*VERDICT\s*\{.*\}\s*$/gm, '').trim()
  if (!m) return { text, verdict: null }
  try {
    const parsed: unknown = JSON.parse(m[1])
    if (typeof parsed !== 'object' || parsed === null) return { text, verdict: null }
    const r = parsed as Record<string, unknown>
    const type = oneOf(VERDICT_TYPES, r.type)
    const website = oneOf(VERDICT_WEBSITE, r.website)
    const action = oneOf(VERDICT_ACTIONS, r.action)
    if (!type || !website || !action) return { text, verdict: null }
    return { text, verdict: { type, website, action, at: new Date().toISOString() } }
  } catch {
    return { text, verdict: null }
  }
}

/** Strips emails and long digit runs before free text goes to the model (names stay out of AI by policy). */
export function redact(s: string): string {
  return s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[電郵]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[號碼]')
}
