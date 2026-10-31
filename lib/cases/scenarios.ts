// Violation-case scenario presets (違規個案情境).
//
// Each scenario maps a venue-rule breach to the clause it comes from, a default fee and the
// default follow-up. The fee amounts mirror content/legal/terms.zh-HK.ts — if the terms change,
// change them here too. Admin can override the amount on any case except where `fixedAmount`.

export type CaseScenario = 'smoking' | 'damage' | 'overtime' | 'over_capacity' | 'pet' | 'other'

export type ScenarioPreset = {
  id: CaseScenario
  label: string
  /** Clause in 《場地使用守則及條款》 the case is based on. */
  clause: string
  /** Suggested fee in HKD, or null when it depends on the incident. */
  defaultAmount: number | null
  /** Lowest allowed fee for a charge (0 is always allowed = warning only). */
  minChargeAmount: number
  /** The terms fix the fee, so admin cannot change it. */
  fixedAmount: boolean
  applyBlacklistByDefault: boolean
  /** Days the member has to pay before the case turns overdue. */
  dueDays: number
  /** Short prompt telling admin / Spark what to record. */
  hint: string
}

export const SCENARIOS: Record<CaseScenario, ScenarioPreset> = {
  smoking: {
    id: 'smoking',
    label: '吸煙／電子煙',
    clause: '第02條',
    defaultAmount: 500,
    minChargeAmount: 500,
    fixedAmount: false,
    applyBlacklistByDefault: true,
    dueDays: 7,
    hint: '記錄發現時間、CCTV 時段及是否有煙味／殘留物。條款清潔費為 HK$500，實際費用較高可按實際計。',
  },
  damage: {
    id: 'damage',
    label: '損壞設施',
    clause: '第05條',
    defaultAmount: null,
    minChargeAmount: 300,
    fixedAmount: false,
    applyBlacklistByDefault: false,
    dueDays: 14,
    hint: '記錄損壞項目及相片，金額按維修／更換發票，最低 HK$300。',
  },
  overtime: {
    id: 'overtime',
    label: '超時離場',
    clause: '第03條',
    defaultAmount: null,
    minChargeAmount: 1.5,
    fixedAmount: false,
    applyBlacklistByDefault: false,
    dueDays: 7,
    hint: '超過時段結束 10 分鐘仍未離場，按每小時正價租金計（不足一小時作一小時）。',
  },
  over_capacity: {
    id: 'over_capacity',
    label: '超出人數上限',
    clause: '第02條',
    defaultAmount: null,
    minChargeAmount: 1.5,
    fixedAmount: false,
    applyBlacklistByDefault: false,
    dueDays: 7,
    hint: '每間球室上限 8 人。記錄 CCTV 點算人數；首次可先作警告（金額填 0）。',
  },
  pet: {
    id: 'pet',
    label: '攜帶寵物',
    clause: '第02條',
    defaultAmount: null,
    minChargeAmount: 1.5,
    fixedAmount: false,
    applyBlacklistByDefault: false,
    dueDays: 7,
    hint: '導盲犬除外。首次可先作警告（金額填 0）。',
  },
  other: {
    id: 'other',
    label: '其他違規',
    clause: '第08條',
    defaultAmount: null,
    minChargeAmount: 1.5,
    fixedAmount: false,
    applyBlacklistByDefault: false,
    dueDays: 7,
    hint: '註明違反的條款及事實經過。',
  },
}

export const SCENARIO_LIST: ScenarioPreset[] = Object.values(SCENARIOS)

export function isCaseScenario(v: unknown): v is CaseScenario {
  return typeof v === 'string' && v in SCENARIOS
}

export type CaseStatus = 'draft' | 'notified' | 'paid' | 'overdue' | 'waived' | 'cancelled'

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  draft: '未發送',
  notified: '待繳付',
  paid: '已繳付',
  overdue: '已逾期',
  waived: '已豁免',
  cancelled: '已取消',
}

/** Statuses in which the member can still pay. */
export const PAYABLE_STATUSES: CaseStatus[] = ['notified', 'overdue']
