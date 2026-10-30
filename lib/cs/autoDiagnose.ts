/**
 * Automatic debug report for a CS case: Spark finds the customer's account log and the Vercel
 * log lines for that account, works out what went wrong, and the result is emailed to the owner.
 * Read-only investigation. Sent once per case unless forced.
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { adminMailShell, escapeHtml, mailButton, mailCallout, mailFacts, mailText, sendAdminMail } from '@/lib/admin/alertMail'
import { addCaseNote, applyVerdict, CS_CATEGORY_LABEL, getCase } from './core'
import { sparkDiagnose } from './spark'
import { splitVerdict, VERDICT_ACTION_LABEL, VERDICT_TYPE_LABEL } from './verdict'

const EXTRA =
  '請先用 get_account_logs 查這位會員的帳戶紀錄（預約、付款嘗試與事件、網站錯誤、通知失敗）和 Vercel 日誌中與該會員／預約有關的行，必要時再用 get_vercel_logs、get_db_health、get_payment_timeline、check_kpay_order 交叉核對，找出問題原因。' +
  '結論要分清楚：是客人操作問題、付款／KPay 問題、還是網站 bug；如果是 bug，指出最可能出錯的位置（路由或功能）和證據，並說明開發者（Luca）需要做什麼。'

export type AutoDiagnoseResult = { ok: true; emailed: boolean; text: string } | { ok: false; error: string }

export async function runAutoDiagnose(input: { caseId: string; adminEmail: string; force?: boolean }): Promise<AutoDiagnoseResult> {
  const db = getLegacyServiceSupabase()
  let found = await getCase(input.caseId)
  if (!found) return { ok: false, error: '找不到工單' }
  if (found.case.auto_report_at && !input.force) return { ok: false, error: '這張工單已自動調查並電郵過' }

  // No member linked yet: try the booking code.
  if (!found.case.user_id && found.case.booking_code) {
    const code = found.case.booking_code
    if (/^[A-Za-z0-9_-]{4,40}$/.test(code)) {
      const { data: b } = await db.from('bookings').select('user_id').or(`human_code.eq.${code.toUpperCase()},booking_reference.eq.${code}`).limit(1).maybeSingle()
      const uid = b ? (b as { user_id?: unknown }).user_id : null
      if (typeof uid === 'string') {
        await db.from('cs_cases').update({ user_id: uid }).eq('id', input.caseId)
        found = (await getCase(input.caseId)) ?? found
      }
    }
  }

  const { case: c, notes, customer } = found
  const out = await sparkDiagnose(c, notes, customer?.memberCode ?? null, EXTRA)
  if (!out.text) return { ok: false, error: out.error ?? 'Spark 沒有回應' }

  const { text: reportText, verdict } = splitVerdict(out.text)
  await addCaseNote(c.id, 'Spark', 'spark', `【自動調查】\n${reportText}`)
  await db.from('cs_cases').update({ auto_report_at: new Date().toISOString() }).eq('id', c.id)
  // Stores the verdict and flags a website problem; the report email below is the owner notification.
  if (verdict) await applyVerdict(c.id, verdict, input.adminEmail, { notifyOwner: false })
  const websiteFlag = c.website_issue || verdict?.website === 'yes'

  let emailed = false
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk'}/admin/cs?case=${c.id}`
    await sendAdminMail({
      audience: 'owner',
      subject: `【客務調查】${c.subject.slice(0, 60)}`,
      html: adminMailShell(
        'Spark 客務調查報告',
        `${mailText(`${input.adminEmail} 的客務工單已由 Spark 自動調查（查了客人帳戶紀錄和 Vercel 日誌）。`)}
${mailFacts([
  ['類別', CS_CATEGORY_LABEL[c.category]],
  ['標題', c.subject],
  ['會員編號', customer?.memberCode ?? '-'],
  ['預約編號', c.booking_code ?? '-'],
  ['Spark 判斷', verdict ? `${VERDICT_TYPE_LABEL[verdict.type]} · 建議：${VERDICT_ACTION_LABEL[verdict.action]}` : '-'],
  ['調查步驟', out.steps.map((s) => s.tool).join(' → ') || '-'],
])}
${mailCallout(escapeHtml(reportText))}
${mailButton(url, '打開工單')}`,
        websiteFlag ? 'critical' : 'normal',
        c.subject,
      ),
    })
    emailed = true
    await addCaseNote(c.id, 'system', 'system', '已把 Spark 調查報告電郵給網站負責人')
  } catch (e) {
    await addCaseNote(c.id, 'system', 'system', `調查報告電郵發送失敗：${e instanceof Error ? e.message : '未知錯誤'}`)
  }
  if (websiteFlag && emailed) await db.from('cs_cases').update({ owner_notified_at: new Date().toISOString() }).eq('id', c.id).is('owner_notified_at', null)
  return { ok: true, emailed, text: reportText }
}
