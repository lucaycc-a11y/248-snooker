import { getResend } from '@/lib/resend/client'
import { emailButton, emailDivider, emailParagraph, escapeHtml, renderEmailLayout } from '@/lib/resend/layout'
import { ADMIN_ALERT_FROM, resolveRecipients } from '@/lib/admin/alertMail'
import { money } from '@/lib/admin/today'
import type { MonthlyReportData } from '@/lib/data/getAdminMonthlyReport'
import type { MonthlyAnalysis } from '@/lib/admin/monthlyAnalysis'
import { renderMonthlyPdf } from '@/lib/admin/monthlyPdf'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk').replace(/\/$/, '')

function delta(now: number, before: number): string {
  if (before <= 0) return before === 0 && now === 0 ? '與上期相同' : '上期沒有數據'
  const p = Math.round(((now - before) / before) * 100)
  return `${p >= 0 ? '▲ +' : '▼ '}${p}%`
}

const PRIO_COLOR = { high: '#f87171', medium: '#fbbf24', low: '#22c55e' } as const
const PRIO_LABEL = { high: '優先', medium: '留意', low: '參考' } as const

export function buildMonthlyReportEmail(data: MonthlyReportData, analysis: MonthlyAnalysis): { subject: string; html: string; text: string } {
  const t = data.totals
  const p = data.prevTotals
  const kpi = (label: string, value: string, sub: string) =>
    `<td style="width:50%;padding:6px;"><div style="border:1px solid #262626;border-radius:12px;padding:12px 14px;"><div style="color:#a3a3a3;font-size:12px;">${escapeHtml(label)}</div><div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:2px;">${escapeHtml(value)}</div><div style="color:#a3a3a3;font-size:12px;margin-top:2px;">${escapeHtml(sub)}</div></div></td>`
  const kpis = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>${kpi('收入', money(t.revenue), `${delta(t.revenue, p.revenue)} 對比${data.prevLabel}`)}${kpi('已確認預約', String(t.bookingCount), `${delta(t.bookingCount, p.bookingCount)} 對比${data.prevLabel}`)}</tr><tr>${kpi('新會員', String(data.members.newCount), `${delta(data.members.newCount, data.members.prevCount)} 對比${data.prevLabel}`)}${kpi('付款成功率', data.attempts.successRate === null ? '—' : `${data.attempts.successRate}%`, `失敗 ${data.attempts.failed} · 逾時 ${data.attempts.expired}`)}</tr></table>`

  const top = analysis.suggestions.slice(0, 3).map((s) =>
    `<div style="border-left:3px solid ${PRIO_COLOR[s.priority]};padding:2px 0 2px 12px;margin:0 0 14px;"><div style="color:#ffffff;font-size:15px;font-weight:600;">${escapeHtml(s.title)} <span style="color:${PRIO_COLOR[s.priority]};font-size:12px;font-weight:600;">${PRIO_LABEL[s.priority]}</span></div><div style="color:#a3a3a3;font-size:13px;line-height:1.6;margin-top:3px;">${escapeHtml(s.why)}</div><div style="color:#e5e5e5;font-size:13px;line-height:1.6;margin-top:3px;"><b style="color:#22c55e;">建議</b>　${escapeHtml(s.action)}</div></div>`).join('')

  const plan = analysis.plan.slice(0, 3).map((x) => `<li style="margin:0 0 6px;">${escapeHtml(x.goal)}</li>`).join('')

  const body = [
    emailParagraph(`${escapeHtml(data.label)}營運月報已經準備好，PDF 附喺呢封電郵。以下係重點結論。`),
    analysis.summary ? emailParagraph(`<b>${escapeHtml(analysis.summary)}</b>`) : '',
    kpis,
    `<h3 style="color:#ffffff;font-size:16px;margin:8px 0 12px;">Spark 建議</h3>`,
    top,
    analysis.focus ? emailParagraph(`<b style="color:#22c55e;">下月重點</b>　${escapeHtml(analysis.focus)}`) : '',
    plan ? `<ul style="color:#e5e5e5;font-size:13px;line-height:1.6;padding-left:18px;margin:0 0 16px;">${plan}</ul>` : '',
    emailDivider(),
    emailButton(`${SITE}/admin/report/monthly?month=${data.month}`, '喺後台打開完整月報'),
    emailParagraph(`${data.partial ? `數字截至 ${escapeHtml(data.to)}。` : ''}不包括測試預約及隱藏帳戶。`, { muted: true, small: true, center: true }),
  ].join('\n')

  const html = renderEmailLayout({
    locale: 'zh-HK',
    title: `Space8 ${data.label}營運月報`,
    preheader: analysis.summary || `${data.label}收入 ${money(t.revenue)}，Spark 建議已附上`,
    bodyHtml: body,
    footerHtml: '此月報由 Spark（FORM 開發的 AI 助手）準備，內容根據後台數據自動編製，只供參考。',
  })
  const text = `${data.label}營運月報（由 Spark／FORM 準備）\n收入 ${money(t.revenue)}（${delta(t.revenue, p.revenue)}），預約 ${t.bookingCount}，新會員 ${data.members.newCount}。\n${analysis.summary}\n${analysis.suggestions.slice(0, 3).map((s) => `- ${s.title}：${s.action}`).join('\n')}\n完整月報：${SITE}/admin/report/monthly?month=${data.month}`
  return { subject: `【Space8 月報】${data.label}營運月報（Spark 建議）`, html, text }
}

/** Sends the report (HTML summary + PDF attachment) to the owner and every active admin. */
export async function sendMonthlyReportEmail(data: MonthlyReportData, analysis: MonthlyAnalysis): Promise<{ recipients: string[] }> {
  const recipients = await resolveRecipients('all-admins')
  const pdf = await renderMonthlyPdf(data, analysis)
  const mail = buildMonthlyReportEmail(data, analysis)
  const resend = getResend()
  // One message per admin: the list is small and nobody sees anybody else's address.
  for (const to of recipients) {
    const { error } = await resend.emails.send({
      from: ADMIN_ALERT_FROM, to: [to], subject: mail.subject, html: mail.html, text: mail.text,
      attachments: [{ filename: `Space8-monthly-report-${data.month}.pdf`, content: pdf }],
    })
    if (error) throw new Error(`月報電郵發送失敗（${to}）：${error.message}`)
  }
  return { recipients }
}
