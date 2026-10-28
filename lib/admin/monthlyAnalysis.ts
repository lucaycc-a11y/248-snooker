import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import type { MonthlyReportData } from '@/lib/data/getAdminMonthlyReport'
import { compactStats, ruleSuggestions, type MonthlySuggestion, type Priority } from '@/lib/admin/monthlySuggestions'

export type PlanItem = { area: string; goal: string; steps: string[]; metric: string; effort: 'low' | 'medium' | 'high' }
export type MonthlyAnalysis = {
  source: 'spark' | 'rules'
  summary: string
  /** One line: the single thing to focus on next month. */
  focus: string
  suggestions: MonthlySuggestion[]
  plan: PlanItem[]
  note?: string
}

export const EFFORT_LABEL: Record<PlanItem['effort'], string> = { low: '低', medium: '中', high: '高' }

const SYSTEM = `你是 Spark，由 FORM 開發嘅 AI 助手，同時擔任 Space8（香港預約制私人桌球室，兩間房，靠網站預約、KPay 付款、會員積分／錢包）嘅營銷同經營管理顧問，替老闆分析月報。不要提任何其他公司或模型名稱。

你熟悉以下方法，按數據選用，唔好硬套：
- 營銷：獲客漏斗（曝光→訪問→註冊→首次預約→回頭客）、本地 SEO 同 Google 商家檔案／評分、Google Ads（Performance Max）預算與成效、blog 內容營銷、電郵／會員再營銷、轉介獎勵、限時優惠與稀缺性、季節同節日活動、企業／團體／生日派對包場。
- 收益管理：時段使用率、淡旺季同非繁忙時段優惠（off-peak）、多小時套餐、動態定價測試、取消同爽約政策、提早預約獎勵、客單價提升（加時、附加服務）。
- 會員與留存：第二次到訪率、流失喚回、積分／錢包設計、分層優惠、新會員歡迎流程。
- 經營：付款成功率與渠道風險、優惠碼成本對收益、錯誤與系統穩定性、人手與營業時間安排、關鍵指標（收入、使用率、客單價、新客、回頭客、付款成功率）。
原則：按「影響大、做得到、成本低」排序；每個建議要引用數據；目標要可量度；唔好建議後台做唔到嘅嘢（後台有：優惠碼、電郵發送、blog、價格與規則設定、付款記錄、會員管理、Spark）。

硬性規則：只根據提供嘅數字，絕不編造數字、原因、事件、客戶意見或市場數據；數據不足就講數據不足，並建議點樣收集。目標數字只可以係由現有數字推算嘅建議，並標明係建議。語氣：廣東話書面語，簡短、具體、有優先次序。
只輸出一個 JSON，不要 markdown：
{"summary":"兩句內總結本月表現","focus":"下月最重要嘅一件事，一句","suggestions":[{"priority":"high|medium|low","category":"收入|付款|會員|營運|系統|營銷","title":"≤22 字","why":"引用具體數字嘅原因","action":"一個可以即刻做嘅行動"}],"plan":[{"area":"營銷|營運|定價|會員|系統","goal":"下月目標，可量度","steps":["具體步驟 2 至 4 條"],"metric":"點樣衡量","effort":"low|medium|high"}]}
suggestions 3 至 6 條按重要性排序；plan 3 至 5 項，覆蓋營銷同經營管理，按影響排序。`

const prio = (p: unknown): p is Priority => p === 'high' || p === 'medium' || p === 'low'
const eff = (p: unknown): p is PlanItem['effort'] => p === 'low' || p === 'medium' || p === 'high'
const s = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Validates anything that claims to be an analysis (model output or a client-supplied copy). */
export function sanitizeAnalysis(raw: unknown, source: 'spark' | 'rules'): MonthlyAnalysis | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const sugRaw = Array.isArray(o.suggestions) ? o.suggestions : []
  const suggestions: MonthlySuggestion[] = []
  for (const x of sugRaw.slice(0, 6)) {
    if (typeof x !== 'object' || x === null) continue
    const r = x as Record<string, unknown>
    const title = s(r.title, 60); const why = s(r.why, 240); const action = s(r.action, 240)
    if (!title || !why || !action) continue
    suggestions.push({ priority: prio(r.priority) ? r.priority : 'medium', category: s(r.category, 8) ?? '營運', title, why, action })
  }
  const planRaw = Array.isArray(o.plan) ? o.plan : []
  const plan: PlanItem[] = []
  for (const x of planRaw.slice(0, 5)) {
    if (typeof x !== 'object' || x === null) continue
    const r = x as Record<string, unknown>
    const goal = s(r.goal, 200); const metric = s(r.metric, 160)
    const steps = Array.isArray(r.steps) ? r.steps.map((t) => s(t, 200)).filter((t): t is string => t !== null).slice(0, 4) : []
    if (!goal || !metric || steps.length === 0) continue
    plan.push({ area: s(r.area, 8) ?? '營運', goal, steps, metric, effort: eff(r.effort) ? r.effort : 'medium' })
  }
  if (suggestions.length === 0) return null
  return { source, summary: s(o.summary, 300) ?? '', focus: s(o.focus, 200) ?? '', suggestions, plan, note: s(o.note, 200) ?? undefined }
}

function parse(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const a = t.indexOf('{')
  const z = t.lastIndexOf('}')
  if (a < 0 || z <= a) return null
  try { return JSON.parse(t.slice(a, z + 1)) } catch { return null }
}

/** Deterministic next-month plan, used whenever Spark can't be reached. */
export function rulePlan(d: MonthlyReportData, sug: MonthlySuggestion[]): PlanItem[] {
  const out: PlanItem[] = []
  const cats = new Set(sug.map((x) => x.category))
  if (cats.has('付款')) out.push({ area: '營運', goal: '提升付款成功率並清走待付款預約', steps: ['到「付款記錄」按渠道檢查失敗原因', '釋放長時間待付款嘅時段', '失敗客人用電郵跟進或提供其他付款方式'], metric: '付款成功率、待付款預約數', effort: 'medium' })
  if (cats.has('系統')) out.push({ area: '系統', goal: '清走未處理錯誤', steps: ['按來源處理最多次嘅錯誤', '已停用功能嘅頁面隱藏或停用', '處理完標記為已解決'], metric: '未處理錯誤數', effort: 'low' })
  if (cats.has('收入') || cats.has('營運')) out.push({ area: '營銷', goal: '提升疲弱時段使用率', steps: ['揀收入最低嘅時段或星期', '建立限時優惠碼，並用電郵發送頁通知會員', '一個月後比較該時段張數'], metric: '該時段預約張數', effort: 'low' })
  if (cats.has('會員') || d.members.newCount > 0) out.push({ area: '會員', goal: '將新會員變成第一次預約', steps: ['新會員 7 日內發歡迎電郵並附預約連結', '追蹤註冊後有無預約', '未預約者再發一次提醒'], metric: '新會員首單轉化率', effort: 'medium' })
  out.push({ area: '營銷', goal: '用 blog 累積 SEO 流量', steps: ['選一個目標關鍵字（例如地區＋桌球）', '用 Spark SEO 寫並優化一篇文章', '文中加入預約 CTA 並發佈'], metric: '文章數、blog 帶來嘅預約', effort: 'medium' })
  return out.slice(0, 5)
}

export async function analyseMonth(data: MonthlyReportData): Promise<MonthlyAnalysis> {
  const rules = ruleSuggestions(data)
  const fallback = (note: string): MonthlyAnalysis => ({ source: 'rules', summary: '', focus: rules[0]?.title ?? '', suggestions: rules, plan: rulePlan(data, rules), note })
  try {
    const out = await mimoChat({
      system: SYSTEM,
      user: `${data.label}月報數據：\n${JSON.stringify(compactStats(data))}\n\n系統規則已偵測到（供參考，可補充或修正）：\n${JSON.stringify(rules)}`,
      task: 'explain', maxTokens: 4000, timeoutMs: 50_000,
    })
    const parsed = sanitizeAnalysis(parse(out.text), 'spark')
    if (!parsed) return fallback('Spark 回覆格式不正確，已改用規則分析')
    if (parsed.plan.length === 0) parsed.plan = rulePlan(data, parsed.suggestions)
    return parsed
  } catch (err) {
    console.error('[admin/monthly-analysis] failed', err)
    return fallback(friendlyAiError(err))
  }
}
