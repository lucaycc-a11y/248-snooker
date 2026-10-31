import { getResend } from '@/lib/resend/client'
import { emailButton, emailDivider, emailParagraph, escapeHtml, renderEmailLayout } from '@/lib/resend/layout'
import { SITE_CONTACT } from '@/lib/site/contact'
import { SCENARIOS, type CaseScenario } from './scenarios'

// Emails for violation cases. Written Chinese (customer-facing payment copy), one shared
// layout with every other Space8 email. All dynamic values are escaped here, once.

const FROM = 'Space8 <no-reply@space8.com.hk>'

export type CaseEmailKind = 'notice' | 'reminder' | 'overdue' | 'paid'

export type CaseEmailData = {
  to: string
  memberName: string
  caseNo: string
  scenario: CaseScenario
  title: string
  detail: string | null
  amount: number
  incidentAt: string | null
  dueAt: string | null
  payUrl: string
  blacklisted: boolean
}

const hkDate = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

const hkd = (n: number): string => `HK$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

const multiline = (s: string): string => escapeHtml(s).replace(/\n/g, '<br />')

export function renderCaseEmail(kind: CaseEmailKind, d: CaseEmailData): { subject: string; html: string } {
  const preset = SCENARIOS[d.scenario]
  const name = escapeHtml(d.memberName || '會員')
  const due = hkDate(d.dueAt)
  const incident = hkDate(d.incidentAt)
  const isWarning = d.amount === 0
  const wa = SITE_CONTACT.whatsappUrl
  const parts: string[] = []

  let heading: string
  let subject: string
  switch (kind) {
    case 'reminder':
      heading = '違規個案費用繳付提醒'
      subject = `【Space8】繳付提醒（個案 ${d.caseNo}）`
      break
    case 'overdue':
      heading = '違規個案費用已逾期'
      subject = `【Space8】費用已逾期（個案 ${d.caseNo}）`
      break
    case 'paid':
      heading = '已收到你的繳付'
      subject = `【Space8】繳付成功（個案 ${d.caseNo}）`
      break
    default:
      heading = isWarning ? '違規個案警告通知' : '違規個案通知及費用繳付'
      subject = `【Space8】${isWarning ? '違規警告通知' : '違規個案通知及費用繳付'}（個案 ${d.caseNo}）`
  }

  parts.push(`<h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 20px;">${escapeHtml(heading)}</h1>`)
  parts.push(emailParagraph(`${name} 你好，`))

  if (kind === 'paid') {
    parts.push(emailParagraph(`我們已收到個案 <strong>${escapeHtml(d.caseNo)}</strong>（${escapeHtml(d.title)}）的費用 <strong>${hkd(d.amount)}</strong>，個案已結案。多謝你的配合。`))
  } else {
    const when = incident ? `於 ${escapeHtml(incident)} ` : ''
    parts.push(emailParagraph(`你${when}使用 Space8 場地期間，涉及「${escapeHtml(d.title)}」，違反《場地使用守則及條款》${escapeHtml(preset.clause)}。`))
    if (kind === 'overdue') {
      parts.push(emailParagraph(`此個案的繳付期限${due ? `（${escapeHtml(due)}）` : ''}已過，費用 <strong>${hkd(d.amount)}</strong> 仍未繳付。請盡快繳付，否則本公司有權按條款暫停或取消你的會員資格。`))
    } else if (isWarning) {
      parts.push(emailParagraph('本次為警告，毋須繳費。如再次違規，本公司有權按條款收取費用、暫停會員資格或列入黑名單。'))
    } else {
      parts.push(emailParagraph(`根據條款，須支付費用 <strong>${hkd(d.amount)}</strong>${due ? `，請於 <strong>${escapeHtml(due)}</strong> 前繳付` : ''}。`))
    }
  }

  if (d.detail && kind !== 'paid') {
    parts.push(emailDivider())
    parts.push(emailParagraph(`個案編號：${escapeHtml(d.caseNo)}`, { muted: true, small: true }))
    parts.push(emailParagraph(`事由：${multiline(d.detail)}`, { muted: true, small: true }))
  }

  if (!isWarning && kind !== 'paid') {
    parts.push(emailDivider())
    parts.push(emailButton(escapeHtml(d.payUrl), `前往繳付 ${hkd(d.amount)}`))
    parts.push(`<div style="height:16px;"></div>`)
    parts.push(emailParagraph('此連結為你專屬，請勿轉發。付款頁面由 KPay 提供，支援多種付款方式。', { muted: true, small: true, center: true }))
  }

  if (d.blacklisted && kind !== 'paid') {
    parts.push(emailParagraph('因違規情節，你的會員資格已被暫停，暫時未能預約。如有疑問，請聯絡我們。', { muted: false }))
  }

  if (kind !== 'paid') {
    parts.push(emailParagraph(
      `如對本個案有異議，請${due ? `於 ${escapeHtml(due)} 前` : '盡快'}以 <a href="${escapeHtml(wa)}" style="color:#22c55e;text-decoration:underline;">WhatsApp</a> 聯絡我們，並提供個案編號 ${escapeHtml(d.caseNo)}。`,
      { muted: true, small: true },
    ))
  }

  const html = renderEmailLayout({
    locale: 'zh-HK',
    title: escapeHtml(subject),
    preheader: escapeHtml(isWarning ? `個案 ${d.caseNo}：違規警告通知` : `個案 ${d.caseNo}：${hkd(d.amount)}`),
    bodyHtml: parts.join('\n'),
  })
  return { subject, html }
}

export async function sendCaseEmail(kind: CaseEmailKind, d: CaseEmailData): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  try {
    const { subject, html } = renderCaseEmail(kind, d)
    const res = await getResend().emails.send({ from: FROM, to: d.to, subject, html })
    if (res.error) return { ok: false, error: res.error.message }
    return { ok: true, id: res.data?.id ?? null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
