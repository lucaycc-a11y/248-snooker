import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import { getAdminMonthlyReport, isMonth } from '@/lib/data/getAdminMonthlyReport'
import { compactStats, ruleSuggestions, type MonthlySuggestion, type Priority } from '@/lib/admin/monthlySuggestions'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const SYSTEM = `你是 Spark，由 FORM 開發嘅 AI 助手，替 Space8（香港預約制桌球室）老闆分析月報並提出可執行建議。不要提任何其他公司或模型名稱。
只根據提供嘅數字，絕不編造數字、原因或事件；數據不足就直接講數據不足。語氣：廣東話書面語，簡短、具體、有優先次序。
只輸出一個 JSON：{"summary":"兩句內總結本月表現","suggestions":[{"priority":"high|medium|low","category":"收入|付款|會員|營運|系統","title":"≤22 字","why":"引用具體數字嘅原因","action":"一個可以即刻做嘅行動"}]}
suggestions 3 至 6 條，按重要性排序；每條行動要能夠喺 Space8 後台做到（優惠碼、電郵發送、blog、檢查付款、處理錯誤等）。`

function parse(text: string): { summary: string; suggestions: MonthlySuggestion[] } | null {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const a = t.indexOf('{')
  const z = t.lastIndexOf('}')
  if (a < 0 || z <= a) return null
  try {
    const v: unknown = JSON.parse(t.slice(a, z + 1))
    if (typeof v !== 'object' || v === null) return null
    const o = v as Record<string, unknown>
    if (!Array.isArray(o.suggestions)) return null
    const ok = (p: unknown): p is Priority => p === 'high' || p === 'medium' || p === 'low'
    const suggestions = o.suggestions.flatMap((x): MonthlySuggestion[] => {
      if (typeof x !== 'object' || x === null) return []
      const r = x as Record<string, unknown>
      if (typeof r.title !== 'string' || typeof r.why !== 'string' || typeof r.action !== 'string') return []
      return [{ priority: ok(r.priority) ? r.priority : 'medium', category: typeof r.category === 'string' ? r.category.slice(0, 8) : '營運', title: r.title.slice(0, 60), why: r.why.slice(0, 240), action: r.action.slice(0, 240) }]
    }).slice(0, 6)
    return suggestions.length > 0 ? { summary: typeof o.summary === 'string' ? o.summary.slice(0, 300) : '', suggestions } : null
  } catch {
    return null
  }
}

export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const m = typeof body === 'object' && body !== null && 'month' in body ? String((body as { month: unknown }).month) : undefined
    const data = await getAdminMonthlyReport({ month: isMonth(m) ? m : undefined })
    const rules = ruleSuggestions(data)
    try {
      const out = await mimoChat({
        system: SYSTEM,
        user: `${data.label}月報數據：\n${JSON.stringify(compactStats(data))}\n\n系統規則已偵測到（供參考，可補充或修正）：\n${JSON.stringify(rules)}`,
        task: 'explain', maxTokens: 2500, timeoutMs: 50_000,
      })
      const parsed = parse(out.text)
      if (parsed) return NextResponse.json({ source: 'spark', summary: parsed.summary, suggestions: parsed.suggestions })
    } catch (err) {
      console.error('[admin/monthly-spark] failed', err)
      return NextResponse.json({ source: 'rules', summary: '', suggestions: rules, note: friendlyAiError(err) })
    }
    return NextResponse.json({ source: 'rules', summary: '', suggestions: rules, note: 'Spark 回覆格式不正確，已改用規則分析' })
  },
  { rateLimit: { bucket: 'admin_monthly_spark', max: 15, windowSeconds: 3600, identifierType: 'user' } },
)
