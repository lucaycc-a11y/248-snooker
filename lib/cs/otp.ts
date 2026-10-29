/**
 * Email OTP for CS identity checks. The admin sends a 6-digit code to the address on the
 * customer's account; the customer reads it back and the admin enters it here. The code is
 * only ever stored as an HMAC, expires after 10 minutes and locks after 5 wrong tries.
 */

import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getResend } from '@/lib/resend/client'
import { emailParagraph, escapeHtml, renderEmailLayout } from '@/lib/resend/layout'
import { addCaseNote, getCustomer } from './core'

const TTL_MINUTES = 10
const MAX_ATTEMPTS = 5
const MAX_PER_HOUR = 3
const FROM = 'SPACE8 <no-reply@space8.com.hk>'

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('伺服器未設定 JWT_SECRET，無法發出驗證碼')
  return s
}

function hashCode(id: string, code: string): string {
  return createHmac('sha256', secret()).update(`${id}:${code}`).digest('hex')
}

export type OtpIssueResult = { ok: true; sentTo: string; expiresAt: string } | { ok: false; error: string }

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return '***'
  return `${name.slice(0, 2)}***@${domain}`
}

export async function issueCsOtp(input: { userId: string; adminEmail: string; caseId?: string | null }): Promise<OtpIssueResult> {
  const customer = await getCustomer(input.userId)
  if (!customer) return { ok: false, error: '找不到這位會員' }
  if (!customer.email) return { ok: false, error: '這位會員帳戶沒有登記電郵' }

  const db = getLegacyServiceSupabase()
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('cs_otp_challenges').select('id', { count: 'exact', head: true }).eq('user_id', input.userId).gte('created_at', since)
  if ((count ?? 0) >= MAX_PER_HOUR) return { ok: false, error: `每小時最多發 ${MAX_PER_HOUR} 次驗證碼，請稍後再試` }

  const id = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString()
  const { error: insErr } = await db.from('cs_otp_challenges').insert({
    id,
    user_id: input.userId,
    email: customer.email,
    code_hash: hashCode(id, code),
    expires_at: expiresAt,
    created_by: input.adminEmail,
    case_id: input.caseId ?? null,
  })
  if (insErr) return { ok: false, error: '建立驗證碼失敗，請重試' }

  const html = renderEmailLayout({
    locale: 'zh-HK',
    title: 'Space8 身份驗證碼',
    preheader: `你的驗證碼：${code}`,
    bodyHtml:
      emailParagraph(escapeHtml(`你好${customer.displayName ? ` ${customer.displayName}` : ''}，`)) +
      emailParagraph('Space8 客務團隊正在核對你的身份。請把以下驗證碼告知客務人員：') +
      `<p style="text-align:center;margin:24px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#ffffff;">${escapeHtml(code)}</p>` +
      emailParagraph(`驗證碼 ${TTL_MINUTES} 分鐘內有效。如果你沒有聯絡過 Space8，請忽略這封電郵，並且不要把驗證碼告訴任何人。`, { muted: true, small: true }),
    footerHtml: 'Space8 · 請勿回覆此電郵',
  })
  const { error: mailErr } = await getResend().emails.send({ from: FROM, to: customer.email, subject: `Space8 身份驗證碼 ${code}`, html })
  if (mailErr) {
    await db.from('cs_otp_challenges').delete().eq('id', id)
    return { ok: false, error: `電郵發送失敗：${mailErr.message}` }
  }
  if (input.caseId) await addCaseNote(input.caseId, input.adminEmail, 'otp', `已發送電郵驗證碼到 ${maskEmail(customer.email)}`)
  return { ok: true, sentTo: maskEmail(customer.email), expiresAt }
}

export type OtpVerifyResult = { ok: true } | { ok: false; error: string }

export async function verifyCsOtp(input: { userId: string; code: string; adminEmail: string; caseId?: string | null }): Promise<OtpVerifyResult> {
  if (!/^\d{6}$/.test(input.code)) return { ok: false, error: '驗證碼必須是 6 位數字' }
  const db = getLegacyServiceSupabase()
  const { data } = await db
    .from('cs_otp_challenges')
    .select('id, code_hash, expires_at, attempts, verified_at')
    .eq('user_id', input.userId)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { id: string; code_hash: string; expires_at: string; attempts: number } | null
  if (!row) return { ok: false, error: '沒有有效的驗證碼（已過期或未發送），請重新發送' }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: '錯誤次數太多，這個驗證碼已鎖定，請重新發送' }

  await db.from('cs_otp_challenges').update({ attempts: row.attempts + 1 }).eq('id', row.id)
  const expected = Buffer.from(row.code_hash, 'hex')
  const actual = Buffer.from(hashCode(row.id, input.code), 'hex')
  const match = expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!match) {
    if (input.caseId) await addCaseNote(input.caseId, input.adminEmail, 'otp', '驗證碼核對失敗')
    return { ok: false, error: `驗證碼不正確（還有 ${Math.max(0, MAX_ATTEMPTS - row.attempts - 1)} 次機會）` }
  }
  await db.from('cs_otp_challenges').update({ verified_at: new Date().toISOString() }).eq('id', row.id)
  if (input.caseId) await addCaseNote(input.caseId, input.adminEmail, 'otp', '身份核對成功（電郵驗證碼）')
  return { ok: true }
}
