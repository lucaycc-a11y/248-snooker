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
  bookingCode?: string | null
  notifiedAt?: string | null
  /** When the member agreed to the terms (from terms_acceptances), if on record. */
  termsAcceptedAt?: string | null
  termsVersion?: string | null
  /** Days the member gets to pay after this letter. */
  graceDays?: number
  now?: Date
}

const hkDate = (d: Date): string =>
  new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }).format(d)

const hkDateTime = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

// Verbatim from content/legal/terms.zh-HK.ts — keep in sync if the terms change.
const CLAUSE_EXCERPT: Partial<Record<CaseScenario, string>> = {
  smoking:
    '場內全面禁煙（包括但不限於傳統香煙、電子煙、加熱煙或任何會產生煙霧、氣味或殘留物之裝置）。違反場地規則，尤其是場內吸煙（含電子煙）導致場地需額外清潔、除味或修復，須支付清潔、除味及相關行政費用港幣 $500 元。此金額為本公司就該等清潔、除味、修復、影響後續使用者及相關損失之預定損害賠償（liquidated damages）估計，並非罰款。本公司並有權將該會員列入黑名單，暫停或永久取消其會員資格及所有未使用之預約，且不作任何退款或補償。本公司保留向違規者追討實際超出 $500 元的清潔、維修或營業損失的權利。',
  damage:
    '如場地內任何設施設備因閣下或閣下同伴之不當使用、疏忽、蓄意破壞或因飲品傾倒、遺留污跡等行為導致損毀、遺失、弄污或功能受損，閣下須承擔全部清潔、維修、更換、復原費用及因暫停營業導致的營業額損失。本公司將根據實際損壞情況評估費用，最低清潔或維修行政費為港幣 $300 元起。',
  overtime:
    '若租用時段結束後超過 10 分鐘仍未完全離場，本公司將向閣下收取超時費用。超時費用以每小時為單位計算，不足一小時亦按一小時正價租金計算。',
  over_capacity:
    '每間桌球室之使用人數上限嚴格限制為 8人。如發現超出人數限制，本公司有權即時終止該時段之使用權，且不作任何退款，並保留追究違約金的權利。',
  pet: '場內亦嚴禁攜帶任何寵物進入（陪同視障人士之導盲犬除外）。',
}

export function buildDemandLetter(d: DemandLetterData): string {
  const now = d.now ?? new Date()
  const grace = d.graceDays ?? 7
  const deadline = new Date(now.getTime() + grace * 86400_000)
  const clause = SCENARIOS[d.scenario].clause
  const incident = d.incidentAt ? new Date(d.incidentAt) : null
  const when = incident && !Number.isNaN(incident.getTime()) ? `於 ${hkDate(incident)} ` : ''
  const fee = `HK$${d.amount.toLocaleString('en-US')}`

  const accepted = hkDateTime(d.termsAcceptedAt)
  const notified = hkDateTime(d.notifiedAt)
  const excerpt = CLAUSE_EXCERPT[d.scenario]
  const ref = d.bookingCode ? `（預約編號 ${d.bookingCode}）` : ''

  const lines = [
    `日期：${hkDate(now)}`,
    `致：${d.memberName || '會員'}${d.memberCode ? `（會員編號 ${d.memberCode}）` : ''}`,
    `事由：追討違規費用（個案編號 ${d.caseNo}）`,
    `${d.memberName || '會員'} 台鑒：`,
    `本公司【公司全名】（Space8）現就以下事項致函閣下。閣下${when}使用本公司場地${ref}期間，涉及「${d.title}」，違反《場地使用守則及條款》${clause}。${d.detail ? `\n事實經過：${d.detail}` : ''}`,
    ...(accepted
      ? [`閣下已於 ${accepted} 預約／付款時，主動勾選同意《場地使用守則及條款》${d.termsVersion ? `（版本 ${d.termsVersion}）` : ''}，該條款構成閣下與本公司之間具法律約束力的協議，本公司備有該同意記錄。`]
      : []),
    ...(excerpt ? [`相關條款原文：\n「${excerpt}」`] : []),
    `根據上述條款，閣下須支付費用 ${fee}。本公司已${notified ? `於 ${notified} ` : ''}透過電郵及會員收件箱通知閣下繳付，惟截至本函日期，款項仍未收到。`,
    `現正式要求閣下於 ${hkDate(deadline)} 前（即本函日期起 ${grace} 日內）繳付 ${fee}。繳付連結（專屬，請勿轉發）：\n${d.payUrl}`,
    `如閣下於上述限期前仍未繳付，本公司保留一切權利，包括但不限於：暫停或取消閣下的會員資格及預約權利；以及向小額錢債審裁處或其他有管轄權的法庭提出申索，追討上述款項及法律容許的利息與訟費，屆時有關程序所生的費用可能由閣下承擔。`,
    `如閣下對本個案有任何異議，請於上述限期前以書面回覆本公司，並提供個案編號 ${d.caseNo} 及相關資料，本公司會予以考慮。如已繳付，請忽略本函。`,
    `此致`,
    `【公司全名】（Space8）\n【負責人姓名及職銜】`,
  ]
  return lines.join('\n\n')
}
