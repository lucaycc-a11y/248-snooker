import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import type { RevenueCheckResult } from '@/lib/admin/revenueCheck'

// The AI only WORDS what the checker already found. It receives the computed
// figures and findings, may not add numbers, and has no tools and no database
// access. If MiMo is unavailable the plain, code-written summary is used.

export type CheckExplanation = { summary: string; model: string | null; aiError: string | null }

const SYSTEM = [
  '你是 Space8 桌球室的後台財務核對助手，對象是店主。',
  '你只會收到由程式計算好的數字和異常清單（JSON）。',
  '規則：',
  '1. 用繁體中文書面語，簡短清楚，最多 220 字。',
  '2. 只可引用資料中出現的數字、預約編號和狀態，不可自行推算、估計或補充任何數字。',
  '3. 先用一句話說整體結論，再按嚴重程度列出要跟進的預約編號及建議的下一步（例如到 KPay 後台核實）。',
  '4. 你不能執行任何操作，只作說明。不要說「已處理」或「已修正」。',
  '5. 沒有異常時，只需確認核對範圍和數字。',
].join('\n')

function plainSummary(result: RevenueCheckResult): string {
  const t = result.totals
  if (!t) return '核對未能完成，請查看下方步驟記錄。'
  const head = `${result.from} 至 ${result.to}：收入 HK$${t.revenue}，已確認預約 ${t.bookingCount} 張，已核對預約 ${t.checkedBookings} 張。`
  if (result.findings.length === 0) return `${head}沒有發現異常。`
  const high = result.findings.filter((f) => f.severity === 'high').length
  return `${head}發現 ${result.findings.length} 項需要留意，其中 ${high} 項嚴重，詳見下方清單。`
}

export async function explainCheck(result: RevenueCheckResult): Promise<CheckExplanation> {
  const fallback = plainSummary(result)
  // Nothing to explain: don't spend an AI call on a clean result.
  if (!result.totals || result.findings.length === 0) {
    return { summary: fallback, model: null, aiError: null }
  }
  try {
    const payload = {
      range: { from: result.from, to: result.to },
      totals: result.totals,
      findings: result.findings.slice(0, 30).map((f) => ({
        severity: f.severity,
        kind: f.kind,
        code: f.code,
        title: f.title,
        detail: f.detail,
      })),
    }
    const out = await mimoChat({ system: SYSTEM, user: JSON.stringify(payload), maxTokens: 700 })
    return { summary: out.text, model: out.model, aiError: null }
  } catch (err) {
    console.error('[revenue-check-ai] explain failed', err)
    return { summary: fallback, model: null, aiError: friendlyAiError(err) }
  }
}
