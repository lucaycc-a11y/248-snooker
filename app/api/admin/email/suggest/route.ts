import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import { plainText } from '@/lib/blog/seoCheck'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

type Kind = 'test' | 'members' | 'all'

const SYSTEM = `你是 Spark，由 FORM 開發嘅 AI 助手，幫 Space8（香港預約制桌球室）後台判斷一封電郵應該點樣發送。不要提任何其他公司或模型名稱。
根據電郵標題同內容，只輸出一個 JSON：{"kind":"test|members|all","reason":"一至兩句廣東話書面語原因","checks":["發送前要留意嘅事，最多 4 條，每條一句"]}
規則：
- 內容未完成（有「—」「CODE」「在這裡寫」等佔位字）→ kind 必須係 "test"，並提醒補完。
- 只涉及特定會員（例如道歉、個別跟進）→ "members"。
- 全體公告、新功能、營業通知 → "all"，但 reason 要提醒先用測試確認。
- 宣傳／優惠類 → 提醒頁尾要有退訂方式（可回覆此信）。
- 不要編造任何數字或人數。`

function placeholderLeft(s: string): boolean {
  return /在這裡寫/.test(s) || /(^|\s)CODE(\s|$)/.test(s) || /(^|\s)—(\s|$)/.test(s)
}

export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const subject = typeof b.subject === 'string' ? b.subject.slice(0, 200) : ''
    const html = typeof b.html === 'string' ? b.html.slice(0, 200_000) : ''
    const text = plainText(html).slice(0, 3000)
    if (!subject.trim() || !text) return NextResponse.json({ error: '標題或內容是空嘅' }, { status: 400 })

    // Deterministic guard: unfinished placeholder text always means "test first", whatever the model says.
    const unfinished = placeholderLeft(text)
    try {
      const out = await mimoChat({ system: SYSTEM, user: `標題：${subject}\n內容：${text}`, task: 'triage', maxTokens: 600, timeoutMs: 25_000 })
      const t = out.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      const a = t.indexOf('{')
      const z = t.lastIndexOf('}')
      const p: unknown = a >= 0 && z > a ? JSON.parse(t.slice(a, z + 1)) : null
      const o = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {}
      let kind: Kind = o.kind === 'members' || o.kind === 'all' || o.kind === 'test' ? o.kind : 'test'
      if (unfinished) kind = 'test'
      const checks = Array.isArray(o.checks) ? o.checks.filter((c): c is string => typeof c === 'string').slice(0, 4) : []
      if (unfinished) checks.unshift('內容仍有未填寫嘅佔位文字，請先補完')
      return NextResponse.json({ kind, reason: typeof o.reason === 'string' ? o.reason.slice(0, 300) : '先發測試電郵俾自己確認效果。', checks: checks.slice(0, 4) })
    } catch (err) {
      console.error('[admin/email/suggest] failed', err)
      return NextResponse.json({ error: friendlyAiError(err) }, { status: 502 })
    }
  },
  { rateLimit: { bucket: 'admin_email_suggest', max: 40, windowSeconds: 3600, identifierType: 'user' } },
)
