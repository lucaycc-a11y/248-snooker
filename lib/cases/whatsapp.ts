import { SCENARIOS, type CaseScenario } from './scenarios'

// WhatsApp draft for a violation case. We never send WhatsApp automatically (no Business API);
// admin gets a ready-to-send text and a wa.me link that opens the chat with it pre-filled.

export type CaseWhatsAppData = {
  memberName: string
  caseNo: string
  scenario: CaseScenario
  title: string
  amount: number
  dueAt: string | null
  payUrl: string
  overdue: boolean
}

const hkDate = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

export function buildCaseWhatsAppDraft(d: CaseWhatsAppData): string {
  const clause = SCENARIOS[d.scenario].clause
  const due = hkDate(d.dueAt)
  const lines: string[] = [`${d.memberName || '會員'} 你好，這裡是 Space8。`]
  lines.push(`你使用場地期間涉及「${d.title}」，違反《場地使用守則及條款》${clause}（個案編號 ${d.caseNo}）。`)
  if (d.amount === 0) {
    lines.push('本次為警告，毋須繳費。如再次違規，本公司有權按條款收取費用、暫停會員資格或列入黑名單。')
  } else {
    const fee = `HK$${d.amount.toLocaleString('en-US')}`
    lines.push(
      d.overdue
        ? `費用 ${fee} 已過繳付期限${due ? `（${due}）` : ''}，請盡快繳付。`
        : `根據條款，須支付費用 ${fee}${due ? `，請於 ${due} 前繳付` : ''}。`,
    )
    lines.push(`繳付連結（專屬，請勿轉發）：\n${d.payUrl}`)
  }
  lines.push(`如有異議，請直接回覆此訊息並提供個案編號 ${d.caseNo}。`)
  return lines.join('\n\n')
}

/** Hong Kong numbers: 8 digits → 852 prefix. Returns null when the number is unusable. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) return `852${digits}`
  if (digits.length >= 10 && digits.length <= 15) return digits
  return null
}

export function whatsAppLink(phone: string | null | undefined, text: string): string {
  const p = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`
}
