import { SCENARIOS, type CaseScenario } from './scenarios'

// Formal demand letter (追討信) draft for an unpaid violation case. Draft only: admin edits it and
// sends it themselves (email / WhatsApp / registered post). Written Chinese, no automatic sending.
// Wording is a template, not legal advice — have a Hong Kong solicitor review it once.

export type DemandLetterData = {
  memberName: string
  memberCode: string | null
  caseNo: string
  scenario: CaseScenario
  title: string
  detail: string | null
  incidentAt: string | null
  amount: number
  payUrl: string
  /** Days the member gets to pay after this letter. */
  graceDays?: number
  now?: Date
}

const hkDate = (d: Date): string =>
  new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }).format(d)

export function buildDemandLetter(d: DemandLetterData): string {
  const now = d.now ?? new Date()
  const grace = d.graceDays ?? 7
  const deadline = new Date(now.getTime() + grace * 86400_000)
  const clause = SCENARIOS[d.scenario].clause
  const incident = d.incidentAt ? new Date(d.incidentAt) : null
  const when = incident && !Number.isNaN(incident.getTime()) ? `於 ${hkDate(incident)} ` : ''
  const fee = `HK$${d.amount.toLocaleString('en-US')}`

  return [
    `日期：${hkDate(now)}`,
    `致：${d.memberName || '會員'}${d.memberCode ? `（會員編號 ${d.memberCode}）` : ''}`,
    `事由：追討違規費用（個案編號 ${d.caseNo}）`,
    `${d.memberName || '會員'} 台鑒：`,
    `本公司【公司全名】（Space8）現就以下事項致函閣下。閣下${when}使用本公司場地期間，涉及「${d.title}」，違反《場地使用守則及條款》${clause}。${d.detail ? `\n事實經過：${d.detail}` : ''}`,
    `根據上述條款，閣下須支付費用 ${fee}。本公司已透過電郵及會員收件箱通知閣下繳付，惟截至本函日期，款項仍未收到。`,
    `現正式要求閣下於 ${hkDate(deadline)} 前（即本函日期起 ${grace} 日內）繳付 ${fee}。繳付連結（專屬，請勿轉發）：\n${d.payUrl}`,
    `如閣下於上述限期前仍未繳付，本公司保留一切權利，包括但不限於：暫停或取消閣下的會員資格及預約權利；以及向小額錢債審裁處或其他有管轄權的法庭提出申索，追討上述款項及法律容許的利息與訟費，屆時有關程序所生的費用可能由閣下承擔。`,
    `如閣下對本個案有任何異議，請於上述限期前以書面回覆本公司，並提供個案編號 ${d.caseNo} 及相關資料，本公司會予以考慮。如已繳付，請忽略本函。`,
    `此致`,
    `【公司全名】（Space8）\n【負責人姓名及職銜】`,
  ].join('\n\n')
}
